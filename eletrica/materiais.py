"""Lista de materiais estimada a partir dos circuitos (para orçamento)."""
import math
from collections import Counter

from . import norma

MARGEM_CABOS = 1.15        # 15% a mais para sobras, subidas e emendas
CONDUTORES_POR_CIRCUITO = 3  # fase + neutro (ou fase + fase) + proteção (PE)


def _fmt_secao(s):
    return f"{s:g}".replace(".", ",") + " mm²"


def listar(dados: dict, resultado: dict) -> list[dict]:
    circuitos = resultado["circuitos"]
    comodos = dados["comodos"]
    n_fases = len({f for c in circuitos for f in c.fases})
    itens = []

    def item(grupo, descricao, qtd, unidade="un"):
        if qtd:
            itens.append({"grupo": grupo, "descricao": descricao, "quantidade": qtd, "unidade": unidade})

    # Proteção
    for (polos, corrente), qtd in sorted(Counter((c.polos, c.disjuntor) for c in circuitos).items()):
        nome = "bipolar" if polos == 2 else "monopolar"
        item("Proteção", f"Disjuntor termomagnético {nome} curva C {corrente} A", qtd)
    for corrente, qtd in sorted(Counter(next(d for d in norma.DR_NOMINAIS if d >= c.disjuntor)
                                        for c in circuitos if c.exige_dr).items()):
        item("Proteção", f"Interruptor DR bipolar {corrente} A / 30 mA", qtd)
    item("Proteção", "DPS classe II 275 V (um por fase e um para o neutro)", n_fases + 1)

    # Quadro: módulos DIN dos disjuntores + DR (2) + DPS + geral (até 3) + 20% de reserva
    modulos = sum(c.polos for c in circuitos) + 2 * sum(c.exige_dr for c in circuitos) + (n_fases + 1) + 3
    item("Proteção", f"Quadro de distribuição de embutir com barramento (mín. {math.ceil(modulos * 1.2)} módulos DIN)", 1)

    # Condutores (metros por seção)
    metros = Counter()
    for c in circuitos:
        metros[c.secao] += c.distancia * CONDUTORES_POR_CIRCUITO * MARGEM_CABOS
    for secao in sorted(metros):
        item("Condutores", f"Cabo flexível 750 V {_fmt_secao(secao)} (fase, neutro e terra — separar por cor)",
             math.ceil(metros[secao]), "m")

    # Pontos
    item("Pontos", "Tomada 2P+T 10 A (uso geral)", sum(c["tug_pontos"] for c in comodos))
    tue_127 = sum(1 for c in circuitos if c.tipo == "tue" and c.polos == 1 and c.disjuntor <= 16)
    item("Pontos", "Tomada 2P+T 20 A (uso específico)", tue_127)
    item("Pontos", "Ponto de luz no teto (caixa octogonal)", sum(c["il_pontos"] for c in comodos))
    item("Pontos", "Interruptor simples", len(comodos))
    item("Pontos", "Caixa 4x2 para tomadas e interruptores",
         sum(c["tug_pontos"] for c in comodos) + len(comodos) + tue_127)
    return itens
