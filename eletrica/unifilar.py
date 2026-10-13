"""Diagrama unifilar simplificado do quadro de distribuição, em SVG."""
from html import escape

NOMES_ALIMENTACAO = {"monofasico": "Monofásico", "bifasico": "Bifásico", "trifasico": "Trifásico"}


def _secao(s):
    return f"{s:g}".replace(".", ",")


def gerar(dados: dict, resultado: dict) -> str:
    p = dados["projeto"]
    circuitos = resultado["circuitos"]
    passo, topo = 54, 150
    altura = topo + passo * len(circuitos) + 40
    largura = 1080
    barra_x = 250
    fases = {"monofasico": "F + N + PE", "bifasico": "2F + N + PE", "trifasico": "3F + N + PE"}[p["alimentacao"]]

    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {largura} {altura}" '
         f'font-family="Segoe UI, Arial, sans-serif" font-size="13">',
         '<rect width="100%" height="100%" fill="#fff"/>',
         '<style>.l{stroke:#24191a;stroke-width:2;fill:none}.t{fill:#24191a}.m{fill:#6b5d5f;font-size:11px}'
         '.b{fill:#fff;stroke:#24191a;stroke-width:2}.dr{fill:#fff;stroke:#7a1f2b;stroke-width:2}'
         '.vd{fill:#7a1f2b;font-weight:700;font-size:11px}</style>']

    # Entrada → DPS → disjuntor geral → barramento
    s.append(f'<text x="20" y="30" class="t" font-weight="700" font-size="15">Diagrama unifilar · {escape(p["nome"])}</text>')
    s.append(f'<text x="20" y="50" class="m">Alimentação {NOMES_ALIMENTACAO[p["alimentacao"]].lower()} {p["tensao_fn"]}/{p["tensao_ff"]} V · {fases}</text>')
    s.append(f'<line x1="40" y1="{topo - 50}" x2="40" y2="{topo - 10}" class="l"/>')
    s.append(f'<text x="50" y="{topo - 38}" class="m">Padrão de entrada (concessionária)</text>')
    s.append(f'<line x1="40" y1="{topo - 10}" x2="{barra_x}" y2="{topo - 10}" class="l"/>')
    s.append(f'<rect x="80" y="{topo - 22}" width="46" height="24" class="b"/><text x="103" y="{topo - 6}" text-anchor="middle" class="t" font-size="11">DPS</text>')
    s.append(f'<rect x="160" y="{topo - 22}" width="56" height="24" class="b"/><text x="188" y="{topo - 6}" text-anchor="middle" class="t" font-size="11">Geral</text>')
    s.append(f'<line x1="{barra_x}" y1="{topo - 30}" x2="{barra_x}" y2="{topo + passo * (len(circuitos) - 1) + 10}" '
             f'stroke="#24191a" stroke-width="5"/>')
    s.append(f'<text x="{barra_x + 8}" y="{topo - 34}" class="m">Barramento do quadro (QD)</text>')

    for i, c in enumerate(circuitos):
        y = topo + passo * i
        x = barra_x
        s.append(f'<line x1="{x}" y1="{y}" x2="{largura - 330}" y2="{y}" class="l"/>')
        # disjuntor
        s.append(f'<rect x="{x + 30}" y="{y - 13}" width="62" height="26" rx="3" class="b"/>')
        s.append(f'<text x="{x + 61}" y="{y + 5}" text-anchor="middle" class="t" font-size="12">'
                 f'{c.polos}P {c.disjuntor} A</text>')
        # DR
        if c.exige_dr:
            s.append(f'<rect x="{x + 108}" y="{y - 13}" width="62" height="26" rx="3" class="dr"/>')
            s.append(f'<text x="{x + 139}" y="{y + 5}" text-anchor="middle" class="vd">DR 30 mA</text>')
        # condutor
        s.append(f'<text x="{x + 190}" y="{y - 6}" class="m">{_secao(c.secao)} mm² · fase {c.fases}</text>')
        # número e descrição
        s.append(f'<circle cx="{largura - 318}" cy="{y}" r="13" fill="#1c060a"/>')
        s.append(f'<text x="{largura - 318}" y="{y + 4}" text-anchor="middle" fill="#e3c47a" font-weight="700" font-size="12">{c.numero}</text>')
        desc = c.descricao if len(c.descricao) <= 48 else c.descricao[:47] + "…"
        s.append(f'<text x="{largura - 296}" y="{y - 2}" class="t">{escape(desc)}</text>')
        corrente = f"{c.corrente:.1f}".replace(".", ",")
        queda = f"{c.queda:.2f}".replace(".", ",")
        s.append(f'<text x="{largura - 296}" y="{y + 14}" class="m">{c.va} VA · {c.tensao} V · {corrente} A · '
                 f'queda {queda}%</text>')
    s.append("</svg>")
    return "\n".join(s)
