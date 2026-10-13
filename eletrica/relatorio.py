"""Relatório HTML (para imprimir ou salvar em PDF), JSON e CSV."""
import csv
import io
import json
from dataclasses import asdict
from datetime import date
from html import escape

from . import norma
from .unifilar import NOMES_ALIMENTACAO

NOMES_TIPO = {"iluminacao": "Iluminação", "tomadas": "Tomadas (TUG)", "tue": "Uso específico (TUE)"}


def br(valor, casas=1):
    return f"{valor:.{casas}f}".replace(".", ",")


def json_resultado(dados, resultado, materiais) -> str:
    """Saída estável e legível: ideal para ver no `git diff` o que mudou entre revisões."""
    saida = {
        "projeto": dados["projeto"],
        "comodos": [{k: c[k] for k in ("nome", "tipo", "area", "perimetro", "il_va", "tug_pontos", "tug_va")}
                    | {"equipamentos": [{"nome": e["nome"], "va": e["va"], "tensao": e["tensao"]}
                                        for e in c.get("equipamentos", [])]}
                    for c in dados["comodos"]],
        "circuitos": [asdict(c) | {"corrente": round(c.corrente, 2)} for c in resultado["circuitos"]],
        "carga_fases": resultado["carga_fases"],
        "materiais": materiais,
    }
    return json.dumps(saida, ensure_ascii=False, indent=2) + "\n"


def csv_materiais(materiais) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow(["Grupo", "Descrição", "Quantidade", "Unidade"])
    for m in materiais:
        w.writerow([m["grupo"], m["descricao"], m["quantidade"], m["unidade"]])
    return buf.getvalue()


def html(dados, resultado, materiais, svg, planta_svg="") -> str:
    p, comodos, circuitos = dados["projeto"], dados["comodos"], resultado["circuitos"]
    total_il = sum(c["il_va"] for c in comodos)
    total_tug = sum(sum(c["tug_va"]) for c in comodos)
    total_tue = sum(e["va"] for c in comodos for e in c.get("equipamentos", []))
    total = total_il + total_tug + total_tue

    def linha_comodo(c):
        minimo = f" <small>(mín. {c['tug_minimo']})</small>" if c["tug_pontos"] != c["tug_minimo"] else ""
        equipamentos = "<br>".join(f"{escape(e['nome'])} ({e['va']} VA)" for e in c.get("equipamentos", [])) or "—"
        return (f"<tr><td>{escape(c['nome'])}</td><td>{br(c['area'], 2)}</td><td>{br(c['perimetro'], 2)}</td>"
                f"<td>{c['il_va']}</td><td>{c['tug_pontos']}{minimo}</td><td>{sum(c['tug_va'])}</td>"
                f"<td>{equipamentos}</td></tr>")

    linhas_comodos = "".join(linha_comodo(c) for c in comodos)

    linhas_circ = "".join(
        f"<tr><td><b>{c.numero}</b></td><td>{escape(c.descricao)}</td><td>{NOMES_TIPO[c.tipo]}</td>"
        f"<td>{c.va}</td><td>{c.tensao}</td><td>{br(c.corrente)}</td><td>{c.fases}</td>"
        f"<td class='n'>{c.polos}P {c.disjuntor} A</td><td>{'Sim' if c.exige_dr else '—'}</td>"
        f"<td class='n'>{br(c.secao, 1).replace(',0', '')} mm²</td><td>{br(c.capacidade)}</td>"
        f"<td class='n'>{br(c.distancia, 0)} m</td><td class='n'>{br(c.queda, 2)}%</td></tr>"
        for c in circuitos)

    linhas_fases = "".join(f"<tr><td>Fase {f}</td><td>{v} VA</td></tr>" for f, v in resultado["carga_fases"].items())
    linhas_mat = "".join(f"<tr><td>{escape(m['grupo'])}</td><td>{escape(m['descricao'])}</td>"
                         f"<td>{m['quantidade']} {m['unidade']}</td></tr>" for m in materiais)

    avisos = list(dados.get("avisos", []))
    if resultado["desequilibrio"] > 20:
        avisos.append(f"Desequilíbrio entre fases de {br(resultado['desequilibrio'])}%: avalie remanejar circuitos.")
    avisos += [
        "Iluminação considerada no teto (≥ 2,50 m), por isso dispensada de DR (5.1.3.2.2).",
        "Recomenda-se um DR geral ou por grupo de circuitos; aqui o DR foi indicado por circuito exigido.",
        "Instalar DPS no quadro e garantir aterramento (esquema TN-S) com condutor de proteção em todos os pontos.",
        "Disjuntor geral e padrão de entrada: dimensionar pela demanda conforme a norma da concessionária local.",
        "Ar-condicionado, motores e bombas: confira o disjuntor e a bitola recomendados pelo fabricante "
        "(corrente de partida) e use o maior entre o calculado e o indicado.",
    ]

    return f"""<!DOCTYPE html>
<html lang="pt-br"><head><meta charset="UTF-8">
<title>Pré-dimensionamento elétrico · {escape(p['nome'])}</title>
<style>
  @page {{ size: A4; margin: 12mm; }}
  body {{ font-family: "Segoe UI", Arial, sans-serif; color: #24191a; max-width: 1000px; margin: 0 auto; padding: 24px; font-size: 13.5px; }}
  header {{ border-bottom: 3px solid #c9a24b; padding-bottom: 10px; display: flex; justify-content: space-between; gap: 20px; align-items: flex-end; }}
  h1 {{ margin: 0; color: #7a1f2b; font-size: 22px; }}
  .sub {{ color: #6b5d5f; }}
  .aviso {{ background: #fff4e5; border-left: 4px solid #b7791f; padding: 10px 14px; margin: 16px 0; }}
  h2 {{ color: #7a1f2b; font-size: 15px; text-transform: uppercase; letter-spacing: 1px; margin: 26px 0 8px; }}
  table {{ width: 100%; border-collapse: collapse; }}
  th {{ background: #2e0b12; color: #fff; text-align: left; padding: 6px 7px; font-weight: 600; font-size: 12.5px; }}
  td {{ padding: 6px 7px; border-bottom: 1px solid #e3d3b4; vertical-align: top; }}
  td.n {{ white-space: nowrap; }}
  tfoot td {{ font-weight: 700; background: #f6efe2; }}
  .cards {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 16px; }}
  .card {{ background: #f6efe2; border-radius: 8px; padding: 10px 12px; }}
  .card b {{ display: block; font-size: 20px; }} .card span {{ color: #6b5d5f; font-size: 12px; }}
  ul {{ margin: 6px 0; padding-left: 20px; }}
  svg {{ width: 100%; height: auto; border: 1px solid #e3d3b4; border-radius: 8px; }}
  footer {{ margin-top: 28px; border-top: 1px solid #e3d3b4; padding-top: 8px; color: #6b5d5f; font-size: 12px; display: flex; justify-content: space-between; }}
  small {{ color: #6b5d5f; }}
</style></head><body>
<header>
  <div><h1>Pré-dimensionamento da instalação elétrica</h1>
  <div class="sub">{escape(p['nome'])}{' · ' + escape(p['cliente']) if p['cliente'] else ''}{' · ' + escape(p['cidade']) if p['cidade'] else ''}</div></div>
  <div class="sub">Preparado por<br><b>{escape(p['responsavel'])}</b><br>{date.today():%d/%m/%Y}</div>
</header>

<div class="aviso"><b>Importante:</b> estudo de pré-dimensionamento baseado na ABNT NBR 5410:2004, para orçamento e
planejamento. <b>Não substitui o projeto elétrico</b> elaborado e assinado por profissional habilitado (ART/TRT).</div>

<div class="cards">
  <div class="card"><b>{br(total / 1000, 2)} kVA</b><span>potência instalada</span></div>
  <div class="card"><b>{len(circuitos)}</b><span>circuitos</span></div>
  <div class="card"><b>{sum(c.exige_dr for c in circuitos)}</b><span>circuitos com DR</span></div>
  <div class="card"><b>{NOMES_ALIMENTACAO[p['alimentacao']]}</b><span>{p['tensao_fn']}/{p['tensao_ff']} V</span></div>
</div>

<h2>1. Previsão de cargas por cômodo</h2>
<table><thead><tr><th>Cômodo</th><th>Área (m²)</th><th>Perímetro (m)</th><th>Iluminação (VA)</th><th>Tomadas</th><th>TUG (VA)</th><th>Uso específico</th></tr></thead>
<tbody>{linhas_comodos}</tbody>
<tfoot><tr><td colspan="3">Totais</td><td>{total_il}</td><td>{sum(c['tug_pontos'] for c in comodos)}</td><td>{total_tug}</td><td>{total_tue} VA</td></tr></tfoot></table>

<h2>2. Quadro de circuitos</h2>
<table><thead><tr><th>Nº</th><th>Descrição</th><th>Tipo</th><th>VA</th><th>V</th><th>Ib (A)</th><th>Fase</th><th>Disjuntor</th><th>DR</th><th>Seção</th><th>Iz (A)</th><th>Dist.</th><th>Queda</th></tr></thead>
<tbody>{linhas_circ}</tbody></table>
<p class="sub">Condutores de cobre, PVC 70 °C, método B1. Fatores: temperatura {br(resultado['fct'], 2)}
({p['temperatura_ambiente']} °C) × agrupamento {br(resultado['fca'], 2)} ({p['circuitos_por_eletroduto']} circuitos por eletroduto).
Critérios: In ≥ Ib, In ≤ Iz, seção mínima (1,5 mm² luz / 2,5 mm² força) e queda de tensão ≤ {br(norma.QUEDA_MAXIMA, 0)}%.</p>

<h2>3. Balanço de fases</h2>
<table style="max-width:420px"><tbody>{linhas_fases}</tbody></table>
{'<p class="sub">Desequilíbrio: ' + br(resultado['desequilibrio']) + '%</p>' if len(resultado['carga_fases']) > 1 else ''}

<h2>4. Planta de pontos (esquemática)</h2>
{planta_svg}
<p class="sub">Pontos posicionados automaticamente: luz no centro do teto, tomadas distribuídas pelas paredes e interruptor no canto mais próximo do quadro. O número junto a cada ponto é o circuito.</p>

<h2>5. Diagrama unifilar</h2>
{svg}

<h2>6. Lista de materiais (estimativa)</h2>
<table><thead><tr><th>Grupo</th><th>Item</th><th>Quantidade</th></tr></thead><tbody>{linhas_mat}</tbody></table>
<p class="sub">Cabos: distância do quadro × 3 condutores × 15% de margem. Eletrodutos, caixas de passagem e acabamentos não incluídos.</p>

<h2>7. Observações</h2>
<ul>{''.join(f'<li>{escape(a)}</li>' for a in avisos)}</ul>

<footer><span>Gerado automaticamente a partir de <code>{escape(p.get('arquivo', 'projeto.toml'))}</code></span><span>{escape(p['responsavel'])}</span></footer>
</body></html>"""
