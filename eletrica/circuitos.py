"""Divisão dos circuitos, dimensionamento (disjuntor, condutor, queda de tensão, DR) e balanço de fases."""
from dataclasses import dataclass, field

from . import norma


@dataclass
class Circuito:
    numero: int
    tipo: str                    # iluminacao | tomadas | tue
    descricao: str
    tensao: int
    comodos: list = field(default_factory=list)
    va: int = 0
    distancia: float = 0.0       # do quadro até o ponto mais distante (m)
    exige_dr: bool = False
    corrente: float = 0.0
    disjuntor: int = 0
    polos: int = 1
    secao: float = 0.0
    capacidade: float = 0.0      # corrente que o condutor suporta já com os fatores de correção
    queda: float = 0.0
    fases: str = ""


def _empacotar(itens, limite_va):
    """Agrupa (cômodo, va) em blocos sem passar do limite, mantendo a ordem da casa."""
    grupos, atual, soma = [], [], 0
    for item in itens:
        if atual and soma + item[1] > limite_va:
            grupos.append(atual)
            atual, soma = [], 0
        atual.append(item)
        soma += item[1]
    if atual:
        grupos.append(atual)
    return grupos


def _descrever(prefixo, comodos):
    nomes = list(dict.fromkeys(comodos))
    return f"{prefixo} · {', '.join(nomes)}"


def dividir(dados: dict) -> list[Circuito]:
    p, comodos = dados["projeto"], dados["comodos"]
    vfn = p["tensao_fn"]
    distancia = {c["nome"]: c["distancia_quadro"] for c in comodos}
    tipo = {c["nome"]: c["tipo"] for c in comodos}
    circuitos = []

    def novo(tipo_c, prefixo, grupo, tensao):
        nomes = [nome for nome, _ in grupo]
        c = Circuito(len(circuitos) + 1, tipo_c, _descrever(prefixo, nomes), tensao, list(dict.fromkeys(nomes)),
                     sum(va for _, va in grupo), max(distancia[n] for n in nomes))
        # Iluminação no teto (≥ 2,5 m) fica fora da exigência de DR (5.1.3.2.2)
        c.exige_dr = tipo_c != "iluminacao" and any(tipo[n] in norma.LOCAIS_DR for n in nomes)
        circuitos.append(c)

    # 1) Iluminação
    luz = [(c["nome"], c["il_va"]) for c in comodos]
    for g in _empacotar(luz, p["corrente_max_iluminacao"] * vfn):
        novo("iluminacao", "Iluminação", g, vfn)

    # 2) Tomadas de cozinha, copa, área de serviço e lavanderia (circuitos exclusivos — 9.5.3.2)
    exclusivas = [(c["nome"], va) for c in comodos if c["tipo"] in norma.LOCAIS_TUG_EXCLUSIVO for va in c["tug_va"]]
    for g in _empacotar(exclusivas, p["corrente_max_tomadas"] * vfn):
        novo("tomadas", "Tomadas", g, vfn)

    # 3) Demais tomadas
    demais = [(c["nome"], va) for c in comodos if c["tipo"] not in norma.LOCAIS_TUG_EXCLUSIVO for va in c["tug_va"]]
    for g in _empacotar(demais, p["corrente_max_tomadas"] * vfn):
        novo("tomadas", "Tomadas", g, vfn)

    # 4) Tomadas/pontos de uso específico: um circuito para cada equipamento
    for c in comodos:
        for eq in c.get("equipamentos", []):
            novo("tue", eq["nome"], [(c["nome"], eq["va"])], eq["tensao"])
    return circuitos


def dimensionar(c: Circuito, p: dict) -> None:
    fct = norma.fator_temperatura(p["temperatura_ambiente"])
    fca = norma.fator_agrupamento(p["circuitos_por_eletroduto"])
    c.corrente = c.va / c.tensao
    c.polos = 2 if c.tensao == p["tensao_ff"] else 1

    # Disjuntor: o menor padrão com In ≥ Ib
    c.disjuntor = next((d for d in norma.DISJUNTORES if d >= c.corrente), None)
    if c.disjuntor is None:
        raise ValueError(f"Circuito {c.numero} ({c.descricao}): {c.corrente:.1f} A está acima de 70 A")

    # Condutor: menor seção que (1) respeita o mínimo, (2) aguenta o disjuntor (In ≤ Iz)
    # e (3) mantém a queda de tensão até 4%
    minimo = norma.SECAO_MINIMA[c.tipo]
    for s in norma.SECOES:
        if s < minimo:
            continue
        iz = norma.CAPACIDADE_B1[s] * fct * fca
        queda = 2 * norma.RESISTIVIDADE_COBRE * c.distancia * c.corrente / s / c.tensao * 100
        if iz >= c.disjuntor and queda <= norma.QUEDA_MAXIMA:
            c.secao, c.capacidade, c.queda = s, round(iz, 1), round(queda, 2)
            return
    raise ValueError(f"Circuito {c.numero} ({c.descricao}): nenhuma seção até 35 mm² atende. "
                     "Divida o circuito ou aproxime o quadro.")


def balancear(circuitos: list[Circuito], fases: list[str]) -> dict:
    """Distribui os circuitos nas fases, do maior para o menor, sempre na fase menos carregada."""
    carga = {f: 0.0 for f in fases}
    for c in sorted(circuitos, key=lambda x: x.va, reverse=True):
        if c.polos == 2:
            duas = sorted(fases, key=lambda f: carga[f])[:2]
            for f in duas:
                carga[f] += c.va / 2
            c.fases = "".join(sorted(duas))
        else:
            f = min(fases, key=lambda f: carga[f])
            carga[f] += c.va
            c.fases = f
    return {f: round(v) for f, v in carga.items()}


def calcular(dados: dict) -> dict:
    from .projeto import ALIMENTACOES
    p = dados["projeto"]
    circuitos = dividir(dados)
    for c in circuitos:
        dimensionar(c, p)
    fases = ALIMENTACOES[p["alimentacao"]]
    carga_fases = balancear(circuitos, fases)
    maior, menor = max(carga_fases.values()), min(carga_fases.values())
    desequilibrio = round((maior - menor) / maior * 100, 1) if len(fases) > 1 and maior else 0.0
    return {"circuitos": circuitos, "carga_fases": carga_fases, "desequilibrio": desequilibrio,
            "fct": norma.fator_temperatura(p["temperatura_ambiente"]),
            "fca": norma.fator_agrupamento(p["circuitos_por_eletroduto"])}
