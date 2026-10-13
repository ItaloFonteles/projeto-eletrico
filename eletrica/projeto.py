"""Lê o arquivo .toml do projeto, valida e calcula a previsão de cargas por cômodo."""
import tomllib

from . import norma, planta

ALIMENTACOES = {"monofasico": ["A"], "bifasico": ["A", "B"], "trifasico": ["A", "B", "C"]}


class ErroProjeto(ValueError):
    pass


def carregar(caminho: str) -> dict:
    try:
        with open(caminho, "rb") as f:
            dados = tomllib.load(f)
    except tomllib.TOMLDecodeError as erro:
        raise ErroProjeto(f"Erro de digitação no arquivo: {erro}. Confira as aspas e os colchetes.") from None
    return preparar(dados)


def preparar(dados: dict) -> dict:
    erros = []
    p = dados.setdefault("projeto", {})
    p.setdefault("nome", "Projeto sem nome")
    p.setdefault("cliente", "")
    p.setdefault("cidade", "")
    p.setdefault("responsavel", "Ítalo Fonteles · italofonteles.dev")
    p.setdefault("alimentacao", "bifasico")
    p.setdefault("tensao_fn", 127)
    p.setdefault("tensao_ff", 220)
    p.setdefault("temperatura_ambiente", 30)
    p.setdefault("circuitos_por_eletroduto", 3)
    if p["alimentacao"] not in ALIMENTACOES:
        erros.append(f"alimentacao deve ser {', '.join(ALIMENTACOES)}")
    try:
        fct = norma.fator_temperatura(p["temperatura_ambiente"])
    except ValueError as erro:
        erros.append(str(erro))
        fct = 1.0
    fca = norma.fator_agrupamento(p["circuitos_por_eletroduto"])
    # Critério de projeto: luz e tomadas agrupadas até o disjuntor que cabe na seção mínima
    p.setdefault("corrente_max_iluminacao", norma.disjuntor_maximo(norma.SECAO_MINIMA["iluminacao"], fct, fca))
    p.setdefault("corrente_max_tomadas", norma.disjuntor_maximo(norma.SECAO_MINIMA["tomadas"], fct, fca))

    comodos = dados.get("comodos", [])
    if not comodos:
        erros.append("nenhum cômodo em [[comodos]]")
    nomes = set()
    for i, c in enumerate(comodos, 1):
        rotulo = f"cômodo #{i} ({c.get('nome', '?')})"
        # Cômodo retangular: dá para informar só largura e comprimento
        if "area" not in c and c.get("largura") and c.get("comprimento"):
            c["area"] = round(c["largura"] * c["comprimento"], 2)
            c["perimetro"] = round(2 * (c["largura"] + c["comprimento"]), 2)
        for campo in ("nome", "tipo", "area", "perimetro"):
            if campo not in c:
                erros.append(f"{rotulo}: falta '{campo}'")
        if c.get("nome") in nomes:
            erros.append(f"{rotulo}: nome repetido")
        nomes.add(c.get("nome"))
        if c.get("tipo") not in norma.TIPOS:
            erros.append(f"{rotulo}: tipo '{c.get('tipo')}' inválido (use {', '.join(sorted(norma.TIPOS))})")
        for eq in c.get("equipamentos", []):
            if "nome" not in eq or "potencia_w" not in eq:
                erros.append(f"{rotulo}: equipamento precisa de 'nome' e 'potencia_w'")
            elif eq.get("tensao", p["tensao_fn"]) == p["tensao_ff"] and p["alimentacao"] == "monofasico":
                erros.append(f"{rotulo}: '{eq['nome']}' em {p['tensao_ff']} V, mas a alimentação é monofásica")
    if erros:
        raise ErroProjeto("Erros no projeto:\n- " + "\n- ".join(erros))

    avisos = []
    for c in comodos:
        c["il_va"] = norma.potencia_iluminacao(c["area"])
        c["il_pontos"] = int(c.get("pontos_luz", 1))
        minimo = norma.tomadas_minimas(c["tipo"], c["area"], c["perimetro"])
        pedido = int(c.get("tomadas", minimo))
        if pedido < minimo:
            avisos.append(f"{c['nome']}: {pedido} tomada(s) informada(s), mas a NBR 5410 pede no mínimo {minimo}. "
                          f"Usei {minimo}.")
            pedido = minimo
        c["tug_minimo"] = minimo
        c["tug_pontos"] = pedido
        for eq in c.get("equipamentos", []):
            eq.setdefault("tensao", p["tensao_fn"])
            eq.setdefault("fp", 1.0)
            eq["va"] = round(eq["potencia_w"] / eq["fp"])
    norma.potencias_tomadas(comodos)

    # Planta: posiciona os cômodos sem x/y e estima a distância até o quadro quando não informada
    if planta.posicionar(comodos):
        avisos.append("Cômodos sem posição foram arrumados automaticamente na planta; "
                      "posicione-os no formulário para um desenho fiel à casa.")
    quadro = planta.posicao_quadro(p, comodos)
    estimadas = []
    for c in comodos:
        if not c.get("distancia_quadro"):
            c["distancia_quadro"] = planta.distancia_estimada(c, quadro)
            estimadas.append(c["nome"])
    if estimadas:
        avisos.append(f"Distância até o quadro estimada pela planta (caminho em L + 3 m de subidas): "
                      f"{', '.join(estimadas)}.")
    avisos.extend(planta.sobreposicoes(comodos))

    dados["avisos"] = avisos
    return dados
