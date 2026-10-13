"""Uso:  python -m eletrica projetos/casa-exemplo.toml

Gera em saida/<nome-do-arquivo>/: relatorio.html, unifilar.svg, resultado.json e materiais.csv
"""
import os
import sys

from . import circuitos, materiais, relatorio, unifilar
from .projeto import ErroProjeto, carregar


def gerar(caminho: str, pasta_saida: str = "saida") -> str:
    dados = carregar(caminho)
    dados["projeto"]["arquivo"] = os.path.basename(caminho)
    resultado = circuitos.calcular(dados)
    lista = materiais.listar(dados, resultado)
    svg = unifilar.gerar(dados, resultado)

    destino = os.path.join(pasta_saida, os.path.splitext(os.path.basename(caminho))[0])
    os.makedirs(destino, exist_ok=True)
    arquivos = {
        "relatorio.html": relatorio.html(dados, resultado, lista, svg),
        "unifilar.svg": svg,
        "resultado.json": relatorio.json_resultado(dados, resultado, lista),
        "materiais.csv": relatorio.csv_materiais(lista),
    }
    for nome, conteudo in arquivos.items():
        # utf-8-sig no CSV para o Excel abrir os acentos certos
        codificacao = "utf-8-sig" if nome.endswith(".csv") else "utf-8"
        with open(os.path.join(destino, nome), "w", encoding=codificacao, newline="") as f:
            f.write(conteudo)

    p = dados["projeto"]
    print(f"✔ {p['nome']}: {len(resultado['circuitos'])} circuitos · fases {resultado['carga_fases']}")
    for aviso in dados["avisos"]:
        print(f"  ⚠ {aviso}")
    print(f"  Arquivos em {destino}{os.sep}")
    return destino


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    try:
        for caminho in sys.argv[1:]:
            gerar(caminho)
    except (ErroProjeto, ValueError) as erro:
        print(f"✘ {erro}")
        sys.exit(1)


if __name__ == "__main__":
    main()
