# Projeto elétrico como código

Pré-dimensionamento de **instalações elétricas residenciais pela ABNT NBR 5410**, a partir de um arquivo de texto com os cômodos da casa. Em segundos o programa gera a **previsão de cargas**, a **divisão dos circuitos**, os **disjuntores**, a **bitola dos fios**, os **DRs**, a **queda de tensão**, o **balanço de fases**, o **diagrama unifilar** e a **lista de materiais**.

Como o projeto é um arquivo de texto versionado no **Git**, cada revisão fica registrada: dá para ver exatamente o que mudou ("entrou um ar-condicionado no quarto 2") e recalcular tudo na hora.

> ⚠️ **Ferramenta de pré-dimensionamento** para estudo, orçamento e planejamento. **Não substitui o projeto elétrico** elaborado e assinado por profissional habilitado (engenheiro eletricista com ART ou técnico em eletrotécnica com TRT). Toda instalação deve ser executada por profissional com NR-10.

**Stack:** Python 3.12 (só biblioteca padrão) · TOML · SVG · Git

---

## Formulário web (sem instalar nada)

🔗 **https://italofonteles.github.io/projeto-eletrico/**

- Preencha os cômodos com **largura × comprimento** (área e perímetro são calculados) ou marque "cômodo irregular".
- Escolha os aparelhos numa lista pronta: chuveiros, ar-condicionado de 9 a 24 mil BTU, micro-ondas, forno, cooktop, máquina de lavar, bomba d'água…
- Clique em **Gerar projeto**: o relatório aparece na tela, com botões para **PDF**, **unifilar (SVG)**, **materiais (CSV)** e o **arquivo `.toml`**, que vai para o Git.
- O formulário roda **o mesmo código Python** da pasta `eletrica/` dentro do navegador ([Pyodide](https://pyodide.org)). Os números são os mesmos da linha de comando e dos testes, e nada é enviado para servidor nenhum.
- O rascunho fica salvo no navegador, e dá para reabrir um `.toml` para editar.

## Desenhos: planta de pontos e DXF

- **Planta (monte a casa):** no formulário:
  - arraste os cômodos para montar a casa: as paredes se encaixam quando chegam perto, e o **toque duplo gira** o cômodo, levando portas, janelas e pontos junto;
  - toque num cômodo para usar **+ Porta** e **+ Janela**, e arraste-as pelas paredes. Na barra aparecem a largura, "só o vão" (porta que abre para o outro cômodo) e Remover;
  - arraste **tomadas, interruptores, luzes** e o **QD** para o lugar certo. Tomadas e interruptores grudam na parede. Pontos movidos à mão ficam tracejados, e "Voltar pontos para o automático" desfaz;
  - use **Ampliar/Reduzir** e arraste o fundo para mover a vista (pensado para o celular);
  - cômodos sobrepostos ficam em vermelho.
- **Distribuição automática com portas:** as tomadas **não caem no vão das portas** (folga de 10 cm), e o **interruptor fica ao lado da porta**, do lado da fechadura. Tomada embaixo de janela é permitida.
- **Planta de pontos esquemática** (`planta.svg` e no relatório):
  - luz no centro do teto;
  - tomadas de uso geral e específico distribuídas pelas paredes;
  - interruptor no canto mais próximo do quadro;
  - **número do circuito em cada ponto**;
  - legenda e grade de 1 m.
- **DXF** (`projeto.dxf`, formato R12): planta + unifilar em camadas (`PAREDES`, `LUZ`, `TOMADAS`, `INTERRUPTORES`, `QUADRO`, `UNIFILAR`), em metros. Abre no **AutoCAD, LibreCAD, QCAD e BricsCAD**, para o projetista ajustar e assinar. Validado com o *auditor* do [ezdxf](https://github.com/mozman/ezdxf): 0 erros.
- **Distância até o quadro:** se não for informada, é **estimada pela planta** (caminho em L do quadro ao centro do cômodo + 3 m de subidas).

No `.toml`, a posição é `x`/`y` (canto superior esquerdo do cômodo, em metros) e o quadro é `quadro_x`/`quadro_y` em `[projeto]`. Cômodos sem posição são arrumados automaticamente em fileiras. Portas, janelas e pontos fixados à mão:

```toml
aberturas = [
  { tipo = "porta", parede = "N", inicio = 1.6, largura = 0.9 },                  # N, S, L ou O
  { tipo = "porta", parede = "L", inicio = 3.1, largura = 0.8, folha = false },   # abre para o outro cômodo
  { tipo = "janela", parede = "O", inicio = 1.2, largura = 1.5 },
]
pontos = [
  { tipo = "tug", indice = 2, x = 0.15, y = 0.71 },   # luz | tug | tue | interruptor; x/y relativos ao cômodo
]
```

> A planta é **esquemática**: a posição exata de cada ponto (portas, janelas e móveis) é definida no projeto final e na obra.

## Exemplo

O arquivo [`projetos/casa-exemplo.toml`](projetos/casa-exemplo.toml) descreve uma casa com 2 quartos, 2 banheiros, cozinha, área de serviço e varanda em Boa Vista - RR. O resultado está em [`saida/casa-exemplo/`](saida/casa-exemplo/):

| Arquivo | Conteúdo |
|---|---|
| `relatorio.html` | Relatório completo (abrir no navegador; **Ctrl + P → Salvar como PDF**) |
| `planta.svg` | Planta de pontos esquemática |
| `projeto.dxf` | Planta + unifilar para AutoCAD/LibreCAD |
| `unifilar.svg` | Diagrama unifilar do quadro |
| `materiais.csv` | Lista de materiais (abre no Excel) |
| `resultado.json` | Todos os números, num formato fácil de comparar no Git |

```
✔ Casa Exemplo: 12 circuitos · fases {'A': 11722, 'B': 12682}
```

## Como descrever uma casa

```toml
[projeto]
nome = "Casa da Maria"
cidade = "Boa Vista - RR"
alimentacao = "bifasico"       # monofasico | bifasico | trifasico
tensao_fn = 127
tensao_ff = 220
temperatura_ambiente = 35      # °C
circuitos_por_eletroduto = 3   # pior trecho, na saída do quadro

[[comodos]]
nome = "Banheiro"
tipo = "banheiro"              # sala, dormitorio, cozinha, copa, area_servico, lavanderia, banheiro,
area = 3.6                     # varanda, corredor, garagem, escritorio, externa, outro
                               # (ou, se for retangular: largura = 2.0 e comprimento = 1.8)
perimetro = 7.8
distancia_quadro = 8           # metros, do quadro até o cômodo (para a queda de tensão)
# tomadas = 2                  # opcional: mais tomadas que o mínimo
# pontos_luz = 2               # opcional

  [[comodos.equipamentos]]     # tomadas de uso específico (TUE)
  nome = "Chuveiro"
  potencia_w = 5500
  tensao = 220                 # opcional (padrão: tensão fase-neutro)
  # fp = 0.9                   # opcional (fator de potência)
```

## Como rodar

```bash
python -m eletrica projetos/casa-exemplo.toml
```

Sem Python instalado, pelo Docker (PowerShell):

```bash
docker run --rm -v "${PWD}:/p" -w /p python:3.12-slim python -m eletrica projetos/casa-exemplo.toml
```

## O que é calculado (NBR 5410:2004)

| Etapa | Regra |
|---|---|
| Iluminação | 100 VA nos primeiros 6 m² + 60 VA a cada 4 m² inteiros (9.5.2.1) |
| Quantidade de tomadas | Sala/dormitório: 1 a cada 5 m de perímetro · cozinha, copa, área de serviço e lavanderia: 1 a cada 3,5 m (mín. 2) · banheiro: 1 · demais: 1 até 6 m², depois 1 a cada 5 m (9.5.2.2.1) |
| Potência das tomadas | Locais molhados: 600 VA até 3 tomadas (ou 2, se o conjunto passar de 6) e 100 VA nas demais · outros: 100 VA (9.5.2.2.2) |
| Divisão dos circuitos | Luz separada de tomadas · tomadas de cozinha/área de serviço em circuitos exclusivos (9.5.3.2) · um circuito por equipamento de uso específico · luz e tomadas agrupadas até caberem na seção mínima |
| Disjuntor | Menor valor comercial com In ≥ Ib |
| Condutor | Cobre/PVC, método B1, Tabela 36 · fatores de temperatura (Tab. 40) e agrupamento (Tab. 42) · In ≤ Iz · seção mínima 1,5 mm² (luz) e 2,5 mm² (força) (Tab. 47) |
| Queda de tensão | ≤ 4% nos circuitos terminais (6.2.7.1); aumenta a seção se precisar |
| DR 30 mA | Circuitos que atendem banheiro, cozinha, copa, área de serviço, lavanderia, garagem e áreas externas (5.1.3.2.2) |
| Fases | Distribuição automática, do maior circuito para o menor, na fase menos carregada |

**Fora do escopo:** demanda e padrão de entrada (seguem a norma da concessionária), eletrodutos, iluminação de emergência, SPDA, instalações comerciais e motores.

## Fluxo de trabalho com Git

Cada cliente vira um arquivo em `projetos/`. Toda alteração vira um commit, e o histórico conta a história do projeto:

```bash
git add projetos/casa-maria.toml saida/casa-maria
git commit -m "casa-maria: rev A (proposta inicial)"

# cliente pediu um ar-condicionado no quarto 2
git commit -am "casa-maria: rev B (ar-condicionado no quarto 2)"

git diff HEAD~1 -- saida/casa-maria/resultado.json   # mostra exatamente o que mudou
git tag casa-maria-rev-B                             # marca a versão entregue
```

## Testes

```bash
docker run --rm -v "${PWD}:/p" -w /p python:3.12-slim python -m unittest -v
```

26 testes cobrem as regras da norma (iluminação, quantidade e potência das tomadas, exceção de mais de 6 tomadas molhadas), o dimensionamento (chuveiro, queda de tensão, seções mínimas, In ≤ Iz, DR), o balanço de fases, a planta (pontos dentro dos cômodos, um ponto por carga, distância estimada, sobreposição), portas (tomadas fora do vão, interruptor ao lado), pontos fixados à mão, o DXF e a geração dos arquivos.

## Estrutura

```
projeto-eletrico/
├── index.html + app.js # formulário web (GitHub Pages)
├── eletrica/
│   ├── norma.py       # tabelas e regras da NBR 5410
│   ├── projeto.py     # leitura/validação do .toml e previsão de cargas
│   ├── circuitos.py   # divisão, dimensionamento e balanço de fases
│   ├── materiais.py   # lista de materiais
│   ├── unifilar.py    # diagrama unifilar (SVG)
│   ├── planta.py      # planta de pontos (posições e SVG)
│   ├── dxf.py         # exportação DXF (planta + unifilar)
│   ├── relatorio.py   # relatório HTML, JSON e CSV
│   └── __main__.py    # linha de comando
├── projetos/          # um .toml por casa
├── saida/             # arquivos gerados
└── tests/
```

---

Feito por **Ítalo Fonteles** · [italofonteles.dev](https://italofonteles.dev) · contato@italofonteles.dev
