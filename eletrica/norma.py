"""Tabelas e regras da NBR 5410:2004 usadas no pré-dimensionamento.

Condutores de cobre, isolação PVC 70 °C, método de instalação B1 (eletroduto
embutido em alvenaria), 2 condutores carregados — o caso típico residencial.
"""
import math

# Seções comerciais (mm²) e capacidade de condução de corrente (A) — Tabela 36, método B1, 2 condutores carregados
SECOES = [1.5, 2.5, 4, 6, 10, 16, 25, 35]
CAPACIDADE_B1 = {1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 76, 25: 101, 35: 125}

# Fator de correção de temperatura ambiente para PVC — Tabela 40
FATOR_TEMPERATURA = {10: 1.22, 15: 1.17, 20: 1.12, 25: 1.06, 30: 1.00, 35: 0.94, 40: 0.87, 45: 0.79, 50: 0.71}

# Fator de agrupamento de circuitos no mesmo eletroduto — Tabela 42 (feixe)
_AGRUPAMENTO = [(1, 1.00), (2, 0.80), (3, 0.70), (4, 0.65), (5, 0.60), (6, 0.57),
                (7, 0.54), (8, 0.52), (11, 0.50), (15, 0.45), (19, 0.41)]

# Seção mínima — Tabela 47 (cobre)
SECAO_MINIMA = {"iluminacao": 1.5, "tomadas": 2.5, "tue": 2.5}

# Queda de tensão máxima nos circuitos terminais — 6.2.7.1
QUEDA_MAXIMA = 4.0

# Disjuntores termomagnéticos (corrente nominal, A) mais comuns no mercado
DISJUNTORES = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 70]
DR_NOMINAIS = [25, 40, 63, 80]

# Resistividade do cobre usada na prática de cálculo de queda de tensão (Ω·mm²/m)
RESISTIVIDADE_COBRE = 1 / 56

# Tipos de cômodo aceitos no arquivo do projeto
TIPOS = {"sala", "dormitorio", "cozinha", "copa", "area_servico", "lavanderia", "banheiro",
         "varanda", "corredor", "garagem", "escritorio", "externa", "outro"}

# Locais com regra de 600 VA por tomada (9.5.2.2.2 a)
LOCAIS_600VA = {"cozinha", "copa", "area_servico", "lavanderia", "banheiro"}
# Locais cujas tomadas exigem circuitos exclusivos (9.5.3.2)
LOCAIS_TUG_EXCLUSIVO = {"cozinha", "copa", "area_servico", "lavanderia"}
# Locais que exigem DR de alta sensibilidade (30 mA) — 5.1.3.2.2
LOCAIS_DR = {"banheiro", "cozinha", "copa", "area_servico", "lavanderia", "garagem", "varanda", "externa"}


def fator_temperatura(temperatura: float) -> float:
    """Usa a linha da tabela igual ou imediatamente acima (lado da segurança)."""
    for t in sorted(FATOR_TEMPERATURA):
        if temperatura <= t:
            return FATOR_TEMPERATURA[t]
    raise ValueError(f"temperatura ambiente {temperatura} °C fora da tabela (máx. 50 °C)")


def fator_agrupamento(circuitos: int) -> float:
    for ate, fator in _AGRUPAMENTO:
        if circuitos <= ate:
            return fator
    return 0.38


def disjuntor_maximo(secao: float, fct: float, fca: float) -> int:
    """Maior disjuntor padrão que a seção aguenta com os fatores de correção (In ≤ Iz).

    Usado para limitar o tamanho dos circuitos de luz e tomadas, de forma que
    fiquem com a seção mínima (1,5 / 2,5 mm²) — mais fácil de instalar.
    """
    iz = CAPACIDADE_B1[secao] * fct * fca
    return max(d for d in DISJUNTORES if d <= iz)


def _fracao(valor: float, passo: float) -> int:
    """'1 ponto para cada X m, ou fração' — arredonda para cima sem erro de ponto flutuante."""
    return max(1, math.ceil(round(valor / passo, 6)))


def potencia_iluminacao(area: float) -> int:
    """9.5.2.1.2: 100 VA nos primeiros 6 m² + 60 VA a cada 4 m² inteiros a mais."""
    if area <= 6:
        return 100
    return 100 + 60 * int(round((area - 6) / 4, 6) // 1)


def tomadas_minimas(tipo: str, area: float, perimetro: float) -> int:
    """Quantidade mínima de tomadas de uso geral — 9.5.2.2.1."""
    if tipo == "banheiro":
        return 1                                          # junto ao lavatório
    if tipo in LOCAIS_TUG_EXCLUSIVO:
        return max(2, _fracao(perimetro, 3.5))            # 1 a cada 3,5 m; ≥ 2 na bancada
    if tipo in ("varanda", "externa"):
        return 1
    if tipo in ("sala", "dormitorio"):
        return _fracao(perimetro, 5)                      # 1 a cada 5 m
    if area <= 6:
        return 1
    return _fracao(perimetro, 5)


def potencias_tomadas(comodos: list[dict]) -> None:
    """Atribui a potência de cada tomada (VA) — 9.5.2.2.2. Altera os cômodos recebidos.

    Em cozinha, copa, área de serviço, lavanderia e banheiro: 600 VA até 3 tomadas e
    100 VA nas demais (cada cômodo separado). Se o conjunto desses locais passar de
    6 tomadas, admite-se 600 VA só para as 2 primeiras de cada cômodo.
    """
    total_molhadas = sum(c["tug_pontos"] for c in comodos if c["tipo"] in LOCAIS_600VA)
    limite = 2 if total_molhadas > 6 else 3
    for c in comodos:
        if c["tipo"] in LOCAIS_600VA:
            c["tug_va"] = [600 if i < limite else 100 for i in range(c["tug_pontos"])]
        else:
            c["tug_va"] = [100] * c["tug_pontos"]
