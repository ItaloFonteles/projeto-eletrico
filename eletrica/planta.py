"""Planta esquemática de pontos: posição dos cômodos, pontos (luz, tomadas, interruptores, quadro) e desenho SVG.

Coordenadas em metros, com a origem no canto superior esquerdo e o eixo y para baixo
(como numa folha de papel). É um desenho esquemático para orientar o eletricista e o
projetista — a posição exata dos pontos é ajustada na obra/no projeto final.
"""
import math
from html import escape

ESTREITO = 2.5           # cômodos com menos de 2,5 m de profundidade: nome em uma linha só
RECUO = 0.15            # tomadas e interruptores desenhados um pouco para dentro da parede (m)
LARGURA_ARRUMACAO = 12  # largura máxima (m) da arrumação automática dos cômodos

CORES = {"parede": "#24191a", "piso": "#fbf7ef", "luz": "#7a1f2b", "tomada": "#1f4e8c",
         "texto": "#24191a", "suave": "#6b5d5f", "quadro": "#7a1f2b"}


def dimensoes(c: dict) -> tuple[float, float]:
    """Largura × comprimento; cômodo irregular vira um quadrado de mesma área (só no desenho)."""
    if c.get("largura") and c.get("comprimento"):
        return float(c["largura"]), float(c["comprimento"])
    lado = round(math.sqrt(c["area"]), 2)
    return lado, lado


def posicionar(comodos: list[dict]) -> bool:
    """Arruma em fileiras os cômodos que não têm x/y. Devolve True se arrumou algum."""
    sem = [c for c in comodos if c.get("x") is None or c.get("y") is None]
    if not sem:
        return False
    ids_sem = {id(c) for c in sem}
    y = max((c["y"] + dimensoes(c)[1] for c in comodos if id(c) not in ids_sem), default=0.0)
    x, altura_fila = 0.0, 0.0
    for c in sem:
        w, h = dimensoes(c)
        if x > 0 and x + w > LARGURA_ARRUMACAO:
            x, y, altura_fila = 0.0, y + altura_fila, 0.0
        c["x"], c["y"] = round(x, 2), round(y, 2)
        x += w
        altura_fila = max(altura_fila, h)
    return True


def posicao_quadro(projeto: dict, comodos: list[dict]) -> tuple[float, float]:
    if projeto.get("quadro_x") is not None and projeto.get("quadro_y") is not None:
        return float(projeto["quadro_x"]), float(projeto["quadro_y"])
    # Sem posição informada: no corredor/hall (ou no primeiro cômodo), junto à parede de cima
    alvo = next((c for c in comodos if c["tipo"] == "corredor"), comodos[0])
    return round(alvo["x"] + 0.4, 2), round(alvo["y"] + RECUO, 2)


def distancia_estimada(comodo: dict, quadro: tuple[float, float]) -> float:
    """Caminho do eletroduto: em L do quadro até o centro do cômodo + 3 m de subidas/descidas."""
    w, h = dimensoes(comodo)
    cx, cy = comodo["x"] + w / 2, comodo["y"] + h / 2
    return round(abs(cx - quadro[0]) + abs(cy - quadro[1]) + 3, 1)


def sobreposicoes(comodos: list[dict]) -> list[str]:
    avisos = []
    for i, a in enumerate(comodos):
        aw, ah = dimensoes(a)
        for b in comodos[i + 1:]:
            bw, bh = dimensoes(b)
            dx = min(a["x"] + aw, b["x"] + bw) - max(a["x"], b["x"])
            dy = min(a["y"] + ah, b["y"] + bh) - max(a["y"], b["y"])
            if dx > 0.05 and dy > 0.05:
                avisos.append(f"Na planta, {a['nome']} e {b['nome']} estão sobrepostos. Ajuste a posição dos cômodos.")
    return avisos


def _pelas_paredes(x, y, w, h, n, recuo):
    """n pontos igualmente espaçados ao longo das paredes, em sentido horário."""
    perimetro = 2 * (w + h)
    passo = perimetro / n
    pontos = []
    for i in range(n):
        d = passo * (i + 0.5)
        if d < w:
            pontos.append((x + d, y + recuo, "N"))
        elif d < w + h:
            pontos.append((x + w - recuo, y + d - w, "L"))
        elif d < 2 * w + h:
            pontos.append((x + w - (d - w - h), y + h - recuo, "S"))
        else:
            pontos.append((x + recuo, y + h - (d - 2 * w - h), "O"))
    return [(round(px, 3), round(py, 3), lado) for px, py, lado in pontos]


def pontos(dados: dict, resultado: dict) -> dict:
    """Lista de pontos com posição, tipo e número do circuito."""
    projeto, comodos = dados["projeto"], dados["comodos"]
    circuito_de = {(nome, tipo, i): c.numero for c in resultado["circuitos"] for nome, tipo, i in c.pontos}
    qx, qy = posicao_quadro(projeto, comodos)
    itens = []
    for c in comodos:
        nome, x, y = c["nome"], c["x"], c["y"]
        w, h = dimensoes(c)
        luz = circuito_de.get((nome, "luz", 0))

        n = c["il_pontos"]
        # luz no teto, ao longo do lado maior; em cômodo estreito desce um pouco para caber o nome
        cy = y + h / 2 if h >= ESTREITO else y + h * 0.68
        for k in range(n):
            px, py = (x + w * (k + 1) / (n + 1), cy) if w >= h else (x + w / 2, y + h * (k + 1) / (n + 1))
            itens.append({"tipo": "luz", "comodo": nome, "x": round(px, 3), "y": round(py, 3), "circuito": luz})

        tomadas = [("tug", i, None) for i in range(c["tug_pontos"])]
        tomadas += [("tue", i, eq["nome"]) for i, eq in enumerate(c.get("equipamentos", []))]
        for (tipo, i, rotulo), (px, py, lado) in zip(tomadas, _pelas_paredes(x, y, w, h, len(tomadas), RECUO)):
            itens.append({"tipo": tipo, "comodo": nome, "x": px, "y": py, "lado": lado,
                          "circuito": circuito_de.get((nome, tipo, i)), "rotulo": rotulo})

        cantos = [(x + RECUO, y + RECUO), (x + w - RECUO, y + RECUO), (x + w - RECUO, y + h - RECUO), (x + RECUO, y + h - RECUO)]
        sx, sy = min(cantos, key=lambda q: abs(q[0] - qx) + abs(q[1] - qy))
        itens.append({"tipo": "interruptor", "comodo": nome, "x": round(sx, 3), "y": round(sy, 3), "circuito": luz})
    return {"quadro": (qx, qy), "itens": itens}


# --------------------------------------------------------------------------- desenho SVG
DIRECAO = {"N": (0, 1), "S": (0, -1), "L": (-1, 0), "O": (1, 0)}   # sentido "para dentro" do cômodo


def posicao_rotulo_tomada(p: dict) -> tuple[float, float, str]:
    """Número do circuito ao lado do símbolo, sem invadir o meio do cômodo nem sair dele.

    Paredes de cima/baixo: texto centralizado ao lado do símbolo.
    Paredes laterais: texto começa no símbolo e cresce para dentro do cômodo.
    Devolve (x, y, alinhamento) com alinhamento "inicio" | "meio" | "fim".
    """
    dx, dy = DIRECAO[p["lado"]]
    if p["lado"] in ("N", "S"):
        return p["x"] + 0.24, p["y"] + dy * 0.1, "meio"
    return p["x"] + dx * 0.22, p["y"] + 0.24, ("inicio" if dx > 0 else "fim")


def rotulo_comodo(c: dict) -> dict:
    """Onde e com que tamanho escrever o nome do cômodo (em metros e pt de 48 px/m)."""
    w, h = dimensoes(c)
    area = f"{c['area']:.1f}".replace(".", ",") + " m²"
    estreito = h < ESTREITO
    texto = f"{c['nome']} · {area}" if estreito else c["nome"]
    fonte = max(7.0, min(12.0, (w * 48 - 10) / (0.56 * len(texto))))
    y = c["y"] + (h * 0.32 if estreito else max(0.55, h * 0.27))
    return {"texto": texto, "area": None if estreito else area, "x": c["x"] + w / 2, "y": y, "fonte": round(fonte, 1)}


def _tri(px, py, lado, t):
    """Triângulo (símbolo de tomada) apontando para dentro do cômodo."""
    dx, dy = {"N": (0, 1), "S": (0, -1), "L": (-1, 0), "O": (1, 0)}[lado]
    ox, oy = -dy, dx
    return [(px + ox * t, py + oy * t), (px - ox * t, py - oy * t), (px + dx * t * 1.4, py + dy * t * 1.4)]


def svg(dados: dict, resultado: dict, escala: float = 48) -> str:
    comodos = dados["comodos"]
    info = pontos(dados, resultado)
    qx, qy = info["quadro"]
    xs = [c["x"] for c in comodos] + [c["x"] + dimensoes(c)[0] for c in comodos] + [qx]
    ys = [c["y"] for c in comodos] + [c["y"] + dimensoes(c)[1] for c in comodos] + [qy]
    minx, miny, maxx, maxy = min(xs), min(ys), max(xs), max(ys)
    m = 1.0                                   # margem (m)
    legenda_h = 70
    W = (maxx - minx + 2 * m) * escala
    H = (maxy - miny + 2 * m) * escala + legenda_h

    def X(v):
        return round((v - minx + m) * escala, 1)

    def Y(v):
        return round((v - miny + m) * escala, 1)

    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {H:.0f}" '
         f'font-family="Segoe UI, Arial, sans-serif">',
         f'<rect width="100%" height="100%" fill="#fff"/>']

    # grade de 1 m
    for gx in range(math.floor(minx - m), math.ceil(maxx + m) + 1):
        s.append(f'<line x1="{X(gx)}" y1="{Y(miny - m)}" x2="{X(gx)}" y2="{Y(maxy + m)}" stroke="#f0e8da" stroke-width="1"/>')
    for gy in range(math.floor(miny - m), math.ceil(maxy + m) + 1):
        s.append(f'<line x1="{X(minx - m)}" y1="{Y(gy)}" x2="{X(maxx + m)}" y2="{Y(gy)}" stroke="#f0e8da" stroke-width="1"/>')

    # cômodos
    for c in comodos:
        w, h = dimensoes(c)
        s.append(f'<rect x="{X(c["x"])}" y="{Y(c["y"])}" width="{w * escala:.1f}" height="{h * escala:.1f}" '
                 f'fill="{CORES["piso"]}" stroke="{CORES["parede"]}" stroke-width="3"/>')
        rot = rotulo_comodo(c)
        s.append(f'<text x="{X(rot["x"])}" y="{Y(rot["y"]):.1f}" text-anchor="middle" font-size="{rot["fonte"]}" '
                 f'font-weight="700" fill="{CORES["texto"]}">{escape(rot["texto"])}</text>')
        if rot["area"]:
            s.append(f'<text x="{X(rot["x"])}" y="{Y(rot["y"]) + 13:.1f}" text-anchor="middle" font-size="10" '
                     f'fill="{CORES["suave"]}">{rot["area"]}</text>')

    # pontos
    r = 0.15 * escala
    for p in info["itens"]:
        px, py = X(p["x"]), Y(p["y"])
        num = p["circuito"] or ""
        if p["tipo"] == "luz":
            s.append(f'<circle cx="{px}" cy="{py}" r="{r:.1f}" fill="#fff" stroke="{CORES["luz"]}" stroke-width="2"/>')
            d = r * 0.7
            s.append(f'<path d="M{px - d} {py - d}L{px + d} {py + d}M{px - d} {py + d}L{px + d} {py - d}" '
                     f'stroke="{CORES["luz"]}" stroke-width="1.6"/>')
            s.append(f'<text x="{px + r + 3:.1f}" y="{py - r:.1f}" font-size="10" font-weight="700" fill="{CORES["luz"]}">{num}</text>')
        elif p["tipo"] in ("tug", "tue"):
            tri = _tri(px, py, p["lado"], 0.13 * escala)
            pts = " ".join(f"{a:.1f},{b:.1f}" for a, b in tri)
            preench = CORES["tomada"] if p["tipo"] == "tue" else "#fff"
            s.append(f'<polygon points="{pts}" fill="{preench}" stroke="{CORES["tomada"]}" stroke-width="1.8"/>')
            tx, ty, alinhamento = posicao_rotulo_tomada(p)
            ancora = {"inicio": "start", "meio": "middle", "fim": "end"}[alinhamento]
            rotulo = f'{num}' + (f' {escape(p["rotulo"].split()[0])}' if p.get("rotulo") else "")
            s.append(f'<text x="{X(tx)}" y="{Y(ty) + 3.5:.1f}" text-anchor="{ancora}" font-size="9" '
                     f'font-weight="600" fill="{CORES["tomada"]}">{rotulo}</text>')
        elif p["tipo"] == "interruptor":
            s.append(f'<circle cx="{px}" cy="{py}" r="{0.08 * escala:.1f}" fill="{CORES["texto"]}"/>')
            s.append(f'<text x="{px + 6:.1f}" y="{py + 12:.1f}" font-size="9.5" fill="{CORES["texto"]}">S{num}</text>')

    # quadro
    s.append(f'<rect x="{X(qx) - 0.35 * escala:.1f}" y="{Y(qy) - 0.12 * escala:.1f}" width="{0.7 * escala:.1f}" '
             f'height="{0.24 * escala:.1f}" fill="{CORES["quadro"]}"/>')
    s.append(f'<text x="{X(qx)}" y="{Y(qy) + 0.12 * escala + 12:.1f}" text-anchor="middle" font-size="10" '
             f'font-weight="700" fill="{CORES["quadro"]}">QD</text>')

    # legenda
    ly = H - legenda_h + 22
    lx = 20
    leg = [
        (f'<circle cx="{lx}" cy="{ly}" r="7" fill="#fff" stroke="{CORES["luz"]}" stroke-width="2"/>', "Ponto de luz (nº = circuito)"),
        (f'<polygon points="{lx - 6},{ly - 5} {lx + 6},{ly - 5} {lx},{ly + 6}" fill="#fff" stroke="{CORES["tomada"]}" stroke-width="1.8"/>', "Tomada de uso geral"),
        (f'<polygon points="{lx - 6},{ly - 5} {lx + 6},{ly - 5} {lx},{ly + 6}" fill="{CORES["tomada"]}"/>', "Tomada/ponto de uso específico"),
        (f'<circle cx="{lx}" cy="{ly}" r="4" fill="{CORES["texto"]}"/>', "Interruptor (S + circuito)"),
        (f'<rect x="{lx - 9}" y="{ly - 4}" width="18" height="8" fill="{CORES["quadro"]}"/>', "Quadro de distribuição"),
    ]
    col = (W - 20) / 3
    for i, (simbolo, texto) in enumerate(leg):
        ox, oy = (i % 3) * col, (i // 3) * 24
        s.append(f'<g transform="translate({ox:.1f},{oy})">{simbolo}'
                 f'<text x="{lx + 14}" y="{ly + 4}" font-size="11" fill="{CORES["texto"]}">{texto}</text></g>')
    s.append(f'<text x="{W - 12:.0f}" y="{H - 8:.0f}" text-anchor="end" font-size="10" fill="{CORES["suave"]}">'
             f'Planta esquemática · grade de 1 m · posições aproximadas</text>')
    s.append("</svg>")
    return "\n".join(s)
