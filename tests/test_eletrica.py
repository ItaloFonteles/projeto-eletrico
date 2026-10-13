"""Testes das regras da NBR 5410 e do dimensionamento. Rodar com:
   docker run --rm -v "${PWD}:/p" -w /p python:3.12-slim python -m unittest -v
"""
import os
import tempfile
import unittest

from eletrica import circuitos, dxf, materiais, norma, planta, unifilar
from eletrica.__main__ import gerar
from eletrica.projeto import ErroProjeto, carregar, preparar


def projeto(*comodos, **opcoes):
    return preparar({"projeto": {"nome": "Teste", "temperatura_ambiente": 30,
                                 "circuitos_por_eletroduto": 1, **opcoes},
                     "comodos": [dict(c) for c in comodos]})


SALA = {"nome": "Sala", "tipo": "sala", "area": 18, "perimetro": 17, "distancia_quadro": 5}
COZINHA = {"nome": "Cozinha", "tipo": "cozinha", "area": 9, "perimetro": 12, "distancia_quadro": 5}
BANHEIRO = {"nome": "Banheiro", "tipo": "banheiro", "area": 3, "perimetro": 7, "distancia_quadro": 5}


class TestRegrasDaNorma(unittest.TestCase):
    def test_iluminacao(self):
        self.assertEqual(norma.potencia_iluminacao(5), 100)
        self.assertEqual(norma.potencia_iluminacao(6), 100)
        self.assertEqual(norma.potencia_iluminacao(9.9), 100)    # 3,9 m² a mais: não completa 4 m²
        self.assertEqual(norma.potencia_iluminacao(10), 160)
        self.assertEqual(norma.potencia_iluminacao(18), 280)

    def test_quantidade_de_tomadas(self):
        self.assertEqual(norma.tomadas_minimas("sala", 18, 17), 4)          # 17/5 → 4
        self.assertEqual(norma.tomadas_minimas("dormitorio", 9, 15), 3)     # exatamente 3 × 5 m
        self.assertEqual(norma.tomadas_minimas("cozinha", 9, 12), 4)        # 12/3,5 → 4
        self.assertEqual(norma.tomadas_minimas("cozinha", 3, 6), 2)         # mínimo 2 na bancada
        self.assertEqual(norma.tomadas_minimas("banheiro", 4, 8), 1)
        self.assertEqual(norma.tomadas_minimas("corredor", 5, 10), 1)       # até 6 m²
        self.assertEqual(norma.tomadas_minimas("escritorio", 8, 12), 3)

    def test_potencia_das_tomadas(self):
        d = projeto(SALA, COZINHA, BANHEIRO)
        cozinha = next(c for c in d["comodos"] if c["tipo"] == "cozinha")
        self.assertEqual(cozinha["tug_va"], [600, 600, 600, 100])   # 5 tomadas molhadas no total → até 3 de 600
        self.assertEqual(d["comodos"][0]["tug_va"], [100] * 4)

    def test_mais_de_6_tomadas_molhadas_vale_so_2_de_600(self):
        area = {"nome": "AS", "tipo": "area_servico", "area": 6, "perimetro": 10, "distancia_quadro": 5}
        d = projeto(COZINHA, area, BANHEIRO)        # 4 + 3 + 1 = 8 > 6
        cozinha = d["comodos"][0]
        self.assertEqual(cozinha["tug_va"], [600, 600, 100, 100])

    def test_tomadas_abaixo_do_minimo_geram_aviso(self):
        d = projeto(SALA | {"tomadas": 2})
        self.assertEqual(d["comodos"][0]["tug_pontos"], 4)
        self.assertTrue(any("mínimo 4" in a for a in d["avisos"]))

    def test_fatores(self):
        self.assertEqual(norma.fator_temperatura(30), 1.00)
        self.assertEqual(norma.fator_temperatura(33), 0.94)     # arredonda para a linha mais quente
        self.assertEqual(norma.fator_agrupamento(3), 0.70)
        self.assertEqual(norma.fator_agrupamento(10), 0.50)


class TestDimensionamento(unittest.TestCase):
    def test_chuveiro_5500w_220v(self):
        b = BANHEIRO | {"equipamentos": [{"nome": "Chuveiro", "potencia_w": 5500, "tensao": 220}]}
        d = projeto(b, temperatura_ambiente=35, circuitos_por_eletroduto=3)
        r = circuitos.calcular(d)
        ch = next(c for c in r["circuitos"] if c.tipo == "tue")
        self.assertEqual((ch.disjuntor, ch.polos, ch.secao, ch.exige_dr), (25, 2, 6, True))

    def test_queda_de_tensao_aumenta_a_secao(self):
        perto = BANHEIRO | {"equipamentos": [{"nome": "Chuveiro", "potencia_w": 5500, "tensao": 220}]}
        longe = perto | {"distancia_quadro": 40}
        c_perto = next(c for c in circuitos.calcular(projeto(perto))["circuitos"] if c.tipo == "tue")
        c_longe = next(c for c in circuitos.calcular(projeto(longe))["circuitos"] if c.tipo == "tue")
        self.assertLess(c_perto.secao, c_longe.secao)
        self.assertLessEqual(c_longe.queda, norma.QUEDA_MAXIMA)

    def test_cozinha_tem_circuito_exclusivo_e_dr(self):
        r = circuitos.calcular(projeto(SALA, COZINHA))
        tomadas = [c for c in r["circuitos"] if c.tipo == "tomadas"]
        self.assertTrue(all(set(c.comodos) in ({"Cozinha"}, {"Sala"}) for c in tomadas))
        self.assertTrue(all(c.exige_dr == (c.comodos == ["Cozinha"]) for c in tomadas))

    def test_iluminacao_nao_exige_dr(self):
        r = circuitos.calcular(projeto(BANHEIRO))
        luz = next(c for c in r["circuitos"] if c.tipo == "iluminacao")
        self.assertFalse(luz.exige_dr)

    def test_secoes_minimas_e_coordenacao(self):
        r = circuitos.calcular(projeto(SALA, COZINHA, BANHEIRO, temperatura_ambiente=35, circuitos_por_eletroduto=3))
        for c in r["circuitos"]:
            self.assertGreaterEqual(c.secao, norma.SECAO_MINIMA[c.tipo])
            self.assertLessEqual(c.corrente, c.disjuntor)      # Ib ≤ In
            self.assertLessEqual(c.disjuntor, c.capacidade)    # In ≤ Iz
            if c.tipo != "tue":                                # luz e tomadas ficam na seção mínima
                self.assertEqual(c.secao, norma.SECAO_MINIMA[c.tipo])

    def test_balanco_de_fases(self):
        eqs = [{"nome": f"Equip {i}", "potencia_w": 1000} for i in range(4)]
        d = projeto(SALA | {"equipamentos": eqs}, alimentacao="bifasico")
        r = circuitos.calcular(d)
        self.assertLess(r["desequilibrio"], 30)
        self.assertEqual(set(r["carga_fases"]), {"A", "B"})


class TestEntradaESaida(unittest.TestCase):
    def test_220v_em_monofasico_e_erro(self):
        b = BANHEIRO | {"equipamentos": [{"nome": "Chuveiro", "potencia_w": 5500, "tensao": 220}]}
        with self.assertRaises(ErroProjeto):
            projeto(b, alimentacao="monofasico")

    def test_largura_e_comprimento_viram_area_e_perimetro(self):
        d = projeto({"nome": "Quarto", "tipo": "dormitorio", "largura": 3, "comprimento": 4, "distancia_quadro": 5})
        self.assertEqual((d["comodos"][0]["area"], d["comodos"][0]["perimetro"]), (12, 14))

    def test_tipo_invalido_e_erro(self):
        with self.assertRaises(ErroProjeto):
            projeto(SALA | {"tipo": "sotao"})

    def test_aspas_faltando_vira_mensagem_clara(self):
        caminho = os.path.join(tempfile.mkdtemp(), "x.toml")
        with open(caminho, "w", encoding="utf-8") as f:
            f.write('[projeto]\nnome = "Casa\n')
        with self.assertRaises(ErroProjeto) as ctx:
            carregar(caminho)
        self.assertIn("aspas", str(ctx.exception))

    def test_exemplo_gera_todos_os_arquivos(self):
        saida = tempfile.mkdtemp()
        destino = gerar(os.path.join("projetos", "casa-exemplo.toml"), saida)
        self.assertEqual(sorted(os.listdir(destino)),
                         ["materiais.csv", "planta.svg", "projeto.dxf", "relatorio.html", "resultado.json", "unifilar.svg"])
        with open(os.path.join(destino, "relatorio.html"), encoding="utf-8") as f:
            self.assertIn("Não substitui o projeto elétrico", f.read())

    def test_materiais_e_unifilar(self):
        d = projeto(SALA, COZINHA, BANHEIRO)
        r = circuitos.calcular(d)
        lista = materiais.listar(d, r)
        self.assertTrue(any("DR" in m["descricao"] for m in lista))
        self.assertIn("<svg", unifilar.gerar(d, r))


class TestPlanta(unittest.TestCase):
    def setUp(self):
        self.d = projeto(
            SALA | {"largura": 4.5, "comprimento": 4, "x": 0, "y": 0},
            COZINHA | {"largura": 3, "comprimento": 3, "x": 4.5, "y": 0,
                       "equipamentos": [{"nome": "Micro-ondas", "potencia_w": 1500}]},
            BANHEIRO | {"largura": 2, "comprimento": 1.5, "x": 4.5, "y": 3})
        self.r = circuitos.calcular(self.d)
        self.info = planta.pontos(self.d, self.r)

    def test_quantidade_de_pontos_bate_com_o_calculo(self):
        itens = self.info["itens"]
        for c in self.d["comodos"]:
            dele = [p for p in itens if p["comodo"] == c["nome"]]
            self.assertEqual(sum(p["tipo"] == "tug" for p in dele), c["tug_pontos"])
            self.assertEqual(sum(p["tipo"] == "tue" for p in dele), len(c.get("equipamentos", [])))
            self.assertEqual(sum(p["tipo"] == "luz" for p in dele), c["il_pontos"])
            self.assertEqual(sum(p["tipo"] == "interruptor" for p in dele), 1)

    def test_pontos_dentro_do_comodo_e_com_circuito(self):
        comodos = {c["nome"]: c for c in self.d["comodos"]}
        numeros = {c.numero for c in self.r["circuitos"]}
        for p in self.info["itens"]:
            c = comodos[p["comodo"]]
            w, h = planta.dimensoes(c)
            self.assertTrue(c["x"] <= p["x"] <= c["x"] + w and c["y"] <= p["y"] <= c["y"] + h, p)
            self.assertIn(p["circuito"], numeros)

    def test_distancia_estimada_pela_planta(self):
        d = projeto({"nome": "Quarto", "tipo": "dormitorio", "largura": 3, "comprimento": 3, "x": 6, "y": 0},
                    quadro_x=0, quadro_y=0)
        self.assertEqual(d["comodos"][0]["distancia_quadro"], 7.5 + 1.5 + 3)   # em L + 3 m

    def test_arrumacao_automatica_e_sobreposicao(self):
        d = projeto(SALA, COZINHA)            # sem x/y
        self.assertTrue(all("x" in c and "y" in c for c in d["comodos"]))
        self.assertTrue(any("arrumados automaticamente" in a for a in d["avisos"]))
        d2 = projeto(SALA | {"x": 0, "y": 0}, COZINHA | {"x": 1, "y": 1})
        self.assertTrue(any("sobrepostos" in a for a in d2["avisos"]))

    def test_dxf_valido(self):
        texto = dxf.gerar(self.d, self.r).decode("cp1252")
        linhas = texto.split("\r\n")
        self.assertEqual(linhas[-2], "EOF")
        for secao in ("HEADER", "TABLES", "ENTITIES"):
            self.assertIn(secao, linhas)
        self.assertEqual(linhas.count("SECTION"), linhas.count("ENDSEC"))
        self.assertGreater(linhas.count("LINE"), 20)
        self.assertIn("Cozinha", texto)
        self.assertTrue(len(linhas) % 2 == 1)                         # pares código/valor + linha final vazia


if __name__ == "__main__":
    unittest.main()
