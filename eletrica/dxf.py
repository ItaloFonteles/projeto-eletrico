"""Exporta a planta de pontos e o diagrama unifilar em DXF (formato R12, abre no AutoCAD, LibreCAD, QCAD...).

Escrito à mão, sem bibliotecas, para rodar igual no computador e no navegador.
Unidade: metros. No DXF o eixo y aponta para cima, então a planta é espelhada em y.
"""
from . import planta as pl

# nome da camada → cor do AutoCAD (1 vermelho, 2 amarelo, 3 verde, 4 ciano, 5 azul, 6 magenta, 7 branco/preto)
CAMADAS = {"PAREDES": 7, "TEXTOS": 7, "LUZ": 1, "TOMADAS": 5, "INTERRUPTORES": 3, "QUADRO": 6, "UNIFILAR": 7}


class Desenho:
    def __init__(self):
        self.ent = []

    def _add(self, *pares):
        self.ent.extend(pares)

    def linha(self, camada, x1, y1, x2, y2):
        self._add(0, "LINE", 8, camada, 10, x1, 20, y1, 30, 0.0, 11, x2, 21, y2, 31, 0.0)

    def retangulo(self, camada, x, y, w, h):
        for a, b, c, d in ((x, y, x + w, y), (x + w, y, x + w, y + h), (x + w, y + h, x, y + h), (x, y + h, x, y)):
            self.linha(camada, a, b, c, d)

    def circulo(self, camada, x, y, r):
        self._add(0, "CIRCLE", 8, camada, 10, x, 20, y, 30, 0.0, 40, r)

    def texto(self, camada, x, y, altura, conteudo, centro=False, alinhamento=None):
        """alinhamento: "inicio" (padrão), "meio" ou "fim"; centro=True equivale a "meio"."""
        pares = [0, "TEXT", 8, camada, 10, x, 20, y, 30, 0.0, 40, altura, 1, conteudo]
        codigo = {"meio": 1, "fim": 2}.get("meio" if centro else alinhamento)
        if codigo:  # alinhamento diferente do padrão exige o ponto de alinhamento (11/21)
            pares += [72, codigo, 11, x, 21, y, 31, 0.0]
        self._add(*pares)

    def para_texto(self) -> str:
        cab = [0, "SECTION", 2, "HEADER", 9, "$ACADVER", 1, "AC1009", 9, "$DWGCODEPAGE", 3, "ANSI_1252",
               9, "$INSUNITS", 70, 6, 0, "ENDSEC",
               0, "SECTION", 2, "TABLES",
               0, "TABLE", 2, "LTYPE", 70, 1,
               0, "LTYPE", 2, "CONTINUOUS", 70, 0, 3, "Solid line", 72, 65, 73, 0, 40, 0.0,
               0, "ENDTAB",
               0, "TABLE", 2, "LAYER", 70, len(CAMADAS)]
        for nome, cor in CAMADAS.items():
            cab += [0, "LAYER", 2, nome, 70, 0, 62, cor, 6, "CONTINUOUS"]
        cab += [0, "ENDTAB", 0, "ENDSEC", 0, "SECTION", 2, "ENTITIES"]
        tudo = cab + self.ent + [0, "ENDSEC", 0, "EOF"]
        linhas = []
        for i in range(0, len(tudo), 2):
            codigo, valor = tudo[i], tudo[i + 1]
            if isinstance(valor, float):
                valor = f"{valor:.4f}"
            linhas.append(f"{codigo:>3}")
            linhas.append(str(valor))
        return "\r\n".join(linhas) + "\r\n"


def gerar(dados: dict, resultado: dict) -> bytes:
    d = Desenho()
    comodos = dados["comodos"]
    info = pl.pontos(dados, resultado)

    def Y(y):          # espelha o eixo y (papel → CAD)
        return -y

    # --- planta ----------------------------------------------------------
    for c in comodos:
        w, h = pl.dimensoes(c)
        d.retangulo("PAREDES", c["x"], Y(c["y"] + h), w, h)
        rot = pl.rotulo_comodo(c)
        d.texto("TEXTOS", rot["x"], Y(rot["y"]), rot["fonte"] / 48 * 0.75, rot["texto"].replace("m²", "m2"), centro=True)
        if rot["area"]:
            d.texto("TEXTOS", rot["x"], Y(rot["y"] + 0.27), 0.13, rot["area"].replace("m²", "m2"), centro=True)

    for p in info["itens"]:
        x, y = p["x"], Y(p["y"])
        num = str(p["circuito"] or "")
        if p["tipo"] == "luz":
            d.circulo("LUZ", x, y, 0.15)
            d.linha("LUZ", x - 0.1, y - 0.1, x + 0.1, y + 0.1)
            d.linha("LUZ", x - 0.1, y + 0.1, x + 0.1, y - 0.1)
            d.texto("LUZ", x + 0.2, y + 0.12, 0.12, num)
        elif p["tipo"] in ("tug", "tue"):
            tri = pl._tri(p["x"], p["y"], p["lado"], 0.13)
            for (ax, ay), (bx, by) in zip(tri, tri[1:] + tri[:1]):
                d.linha("TOMADAS", ax, Y(ay), bx, Y(by))
            rotulo = num + (f" {p['rotulo'].split()[0]}" if p.get("rotulo") else "")
            tx, ty, alinhamento = pl.posicao_rotulo_tomada(p)
            d.texto("TOMADAS", tx, Y(ty) - 0.05, 0.11, rotulo, alinhamento=alinhamento)
        elif p["tipo"] == "interruptor":
            d.circulo("INTERRUPTORES", x, y, 0.07)
            d.texto("INTERRUPTORES", x + 0.1, y - 0.2, 0.11, f"S{num}")

    qx, qy = info["quadro"]
    d.retangulo("QUADRO", qx - 0.35, Y(qy) - 0.12, 0.7, 0.24)
    d.texto("QUADRO", qx, Y(qy) - 0.4, 0.14, "QD", centro=True)

    # --- unifilar, à direita da planta ---------------------------------------
    largura_planta = max(c["x"] + pl.dimensoes(c)[0] for c in comodos)
    ox, oy = largura_planta + 3, 0.0
    circuitos = resultado["circuitos"]
    passo = 0.8
    d.texto("UNIFILAR", ox, oy + 0.6, 0.25, f"Diagrama unifilar - {dados['projeto']['nome']}")
    d.linha("UNIFILAR", ox + 1, oy, ox + 1, oy - passo * len(circuitos))           # barramento
    for i, c in enumerate(circuitos):
        y = oy - passo * (i + 0.5)
        d.linha("UNIFILAR", ox + 1, y, ox + 7, y)
        d.retangulo("UNIFILAR", ox + 1.4, y - 0.15, 1.1, 0.3)
        d.texto("UNIFILAR", ox + 1.95, y - 0.06, 0.12, f"{c.polos}P {c.disjuntor}A", centro=True)
        if c.exige_dr:
            d.retangulo("UNIFILAR", ox + 2.8, y - 0.15, 1.1, 0.3)
            d.texto("UNIFILAR", ox + 3.35, y - 0.06, 0.11, "DR 30mA", centro=True)
        d.texto("UNIFILAR", ox + 4.2, y + 0.08, 0.1, f"{c.secao:g} mm2 - fase {c.fases}".replace(".", ","))
        d.texto("UNIFILAR", ox + 7.2, y - 0.06, 0.13, f"{c.numero} - {c.descricao} ({c.va} VA)")

    return d.para_texto().encode("cp1252", errors="replace")
