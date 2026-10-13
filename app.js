// Formulário de pré-dimensionamento. O cálculo é o MESMO código Python da pasta eletrica/,
// executado no navegador pelo Pyodide — uma única fonte de verdade, coberta pelos testes.

const PRESETS = [
  { nome: 'Chuveiro 5.500 W', potencia: 5500, tensao: 'ff', fp: 1 },
  { nome: 'Chuveiro 7.500 W', potencia: 7500, tensao: 'ff', fp: 1 },
  { nome: 'Torneira elétrica', potencia: 5500, tensao: 'ff', fp: 1 },
  { nome: 'Ar-condicionado 9.000 BTU', potencia: 820, tensao: 'ff', fp: 0.9 },
  { nome: 'Ar-condicionado 12.000 BTU', potencia: 1100, tensao: 'ff', fp: 0.9 },
  { nome: 'Ar-condicionado 18.000 BTU', potencia: 1650, tensao: 'ff', fp: 0.9 },
  { nome: 'Ar-condicionado 24.000 BTU', potencia: 2200, tensao: 'ff', fp: 0.9 },
  { nome: 'Micro-ondas', potencia: 1500, tensao: 'fn', fp: 1 },
  { nome: 'Forno elétrico', potencia: 2000, tensao: 'ff', fp: 1 },
  { nome: 'Cooktop de indução', potencia: 3500, tensao: 'ff', fp: 1 },
  { nome: 'Máquina de lavar', potencia: 1000, tensao: 'fn', fp: 1 },
  { nome: 'Secadora de roupas', potencia: 3500, tensao: 'ff', fp: 1 },
  { nome: 'Lava-louças', potencia: 1500, tensao: 'fn', fp: 1 },
  { nome: 'Aquecedor de água (boiler)', potencia: 2000, tensao: 'ff', fp: 1 },
  { nome: "Bomba d'água 1/2 cv", potencia: 600, tensao: 'ff', fp: 0.8 },
  { nome: 'Portão eletrônico', potencia: 400, tensao: 'fn', fp: 0.8 },
  { nome: 'Outro aparelho', potencia: '', tensao: 'fn', fp: 1 },
];

const EXEMPLO = [
  { nome: 'Sala', tipo: 'sala', largura: 4.5, comprimento: 4, distancia: 6, tomadas: 5 },
  { nome: 'Cozinha', tipo: 'cozinha', largura: 3.5, comprimento: 3, distancia: 4,
    equipamentos: [{ nome: 'Micro-ondas', potencia: 1500, tensao: 'fn', fp: 1 },
                   { nome: 'Forno elétrico', potencia: 2000, tensao: 'ff', fp: 1 }] },
  { nome: 'Área de serviço', tipo: 'area_servico', largura: 2.5, comprimento: 2, distancia: 7,
    equipamentos: [{ nome: 'Máquina de lavar', potencia: 1000, tensao: 'fn', fp: 1 }] },
  { nome: 'Corredor', tipo: 'corredor', largura: 1, comprimento: 4, distancia: 5 },
  { nome: 'Quarto 1', tipo: 'dormitorio', largura: 3.2, comprimento: 3.2, distancia: 10,
    equipamentos: [{ nome: 'Ar-condicionado 12.000 BTU', potencia: 1100, tensao: 'ff', fp: 0.9 }] },
  { nome: 'Quarto 2 (suíte)', tipo: 'dormitorio', largura: 3.5, comprimento: 3.5, distancia: 13,
    equipamentos: [{ nome: 'Ar-condicionado 12.000 BTU', potencia: 1100, tensao: 'ff', fp: 0.9 }] },
  { nome: 'Banheiro social', tipo: 'banheiro', largura: 2, comprimento: 1.8, distancia: 8,
    equipamentos: [{ nome: 'Chuveiro', potencia: 5500, tensao: 'ff', fp: 1 }] },
  { nome: 'Banheiro suíte', tipo: 'banheiro', largura: 2, comprimento: 1.6, distancia: 15,
    equipamentos: [{ nome: 'Chuveiro', potencia: 5500, tensao: 'ff', fp: 1 }] },
  { nome: 'Varanda', tipo: 'varanda', largura: 4, comprimento: 2, distancia: 9 },
];

const PYTHON = `
import json, sys, tomllib
sys.path.insert(0, "/home/pyodide")
from eletrica.projeto import preparar, ErroProjeto
from eletrica import circuitos, materiais, unifilar, relatorio

def rodar(entrada):
    try:
        dados = preparar(json.loads(entrada))
        dados["projeto"]["arquivo"] = "formulário web"
        res = circuitos.calcular(dados)
        lista = materiais.listar(dados, res)
        svg = unifilar.gerar(dados, res)
        return json.dumps({"ok": True, "html": relatorio.html(dados, res, lista, svg), "svg": svg,
                           "csv": relatorio.csv_materiais(lista), "avisos": dados["avisos"],
                           "resumo": f"{len(res['circuitos'])} circuitos · fases {res['carga_fases']}"})
    except (ErroProjeto, ValueError) as erro:
        return json.dumps({"ok": False, "erro": str(erro)})

def ler_toml(texto):
    return json.dumps(tomllib.loads(texto))
`;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const listaComodos = $('#comodos');
let py = null;
let ultimo = null;

// ---------------------------------------------------------------- formulário
function sistema() {
  const [fn, ff] = $('#p-tensao').value.split('-').map(Number);
  return { fn, ff };
}

function adicionarEquip(comodoEl, e = {}) {
  const el = $('#tpl-equip').content.firstElementChild.cloneNode(true);
  $('[data-e=nome]', el).value = e.nome ?? '';
  $('[data-e=potencia]', el).value = e.potencia ?? '';
  // Em rede 220/380 V, o que seria fase-fase (220 V) passa a ser fase-neutro
  $('[data-e=tensao]', el).value = sistema().fn === 220 ? 'fn' : (e.tensao ?? 'fn');
  $('[data-e=fp]', el).value = e.fp ?? 1;
  $('.equipamentos', comodoEl).appendChild(el);
}

function atualizarCalculo(el) {
  const manual = $('[data-c=manual]', el).checked;
  $('.manual', el).hidden = !manual;
  const l = parseFloat($('[data-c=largura]', el).value);
  const c = parseFloat($('[data-c=comprimento]', el).value);
  if (!manual && l > 0 && c > 0) {
    $('[data-c=area]', el).value = (l * c).toFixed(2);
    $('[data-c=perimetro]', el).value = (2 * (l + c)).toFixed(2);
  }
  const area = $('[data-c=area]', el).value, per = $('[data-c=perimetro]', el).value;
  $('.calc', el).textContent = area && per ? `Área ${area.replace('.', ',')} m² · perímetro ${per.replace('.', ',')} m` : '';
  $('.titulo', el).textContent = $('[data-c=nome]', el).value || 'Cômodo';
}

function adicionarComodo(c = {}) {
  const el = $('#tpl-comodo').content.firstElementChild.cloneNode(true);
  const preset = $('[data-acao=preset]', el);
  PRESETS.forEach((p, i) => preset.add(new Option(p.potencia ? `${p.nome} (${p.potencia} W)` : p.nome, i)));
  $('[data-c=nome]', el).value = c.nome ?? `Cômodo ${listaComodos.children.length + 1}`;
  $('[data-c=tipo]', el).value = c.tipo ?? 'sala';
  $('[data-c=largura]', el).value = c.largura ?? '';
  $('[data-c=comprimento]', el).value = c.comprimento ?? '';
  $('[data-c=distancia]', el).value = c.distancia ?? 8;
  $('[data-c=tomadas]', el).value = c.tomadas ?? '';
  if (c.area && !c.largura) {
    $('[data-c=manual]', el).checked = true;
    $('[data-c=area]', el).value = c.area;
    $('[data-c=perimetro]', el).value = c.perimetro;
  }
  (c.equipamentos ?? []).forEach(e => adicionarEquip(el, e));
  listaComodos.appendChild(el);
  atualizarCalculo(el);
  return el;
}

function lerFormulario() {
  const { fn, ff } = sistema();
  const projeto = {
    nome: $('#p-nome').value.trim() || 'Projeto sem nome',
    cliente: $('#p-cliente').value.trim(),
    cidade: $('#p-cidade').value.trim(),
    alimentacao: $('#p-alimentacao').value,
    tensao_fn: fn, tensao_ff: ff,
    temperatura_ambiente: Number($('#p-temperatura').value) || 30,
    circuitos_por_eletroduto: Number($('#p-agrupamento').value) || 1,
  };
  const comodos = $$('.comodo', listaComodos).map(el => {
    const v = k => $(`[data-c=${k}]`, el).value;
    const c = {
      nome: v('nome').trim(), tipo: v('tipo'),
      area: Number(v('area')), perimetro: Number(v('perimetro')),
      distancia_quadro: Number(v('distancia')),
    };
    if (v('tomadas')) c.tomadas = Number(v('tomadas'));
    // Guarda as medidas para reabrir o cômodo como foi digitado (o cálculo usa só área e perímetro)
    if (!$('[data-c=manual]', el).checked && Number(v('largura')) > 0) {
      c.largura = Number(v('largura'));
      c.comprimento = Number(v('comprimento'));
    }
    const eqs = $$('.equip', el).map(e => ({
      nome: $('[data-e=nome]', e).value.trim(),
      potencia_w: Number($('[data-e=potencia]', e).value),
      tensao: $('[data-e=tensao]', e).value === 'ff' ? ff : fn,
      fp: Number($('[data-e=fp]', e).value) || 1,
    })).filter(e => e.nome && e.potencia_w > 0);
    if (eqs.length) c.equipamentos = eqs;
    return c;
  });
  return { projeto, comodos };
}

function validar({ comodos }) {
  const erros = [];
  if (!comodos.length) erros.push('Adicione pelo menos um cômodo.');
  comodos.forEach((c, i) => {
    if (!c.nome) erros.push(`Cômodo ${i + 1}: falta o nome.`);
    if (!(c.area > 0 && c.perimetro > 0)) erros.push(`${c.nome || 'Cômodo ' + (i + 1)}: informe largura e comprimento.`);
    if (!(c.distancia_quadro > 0)) erros.push(`${c.nome}: informe a distância até o quadro.`);
  });
  const nomes = comodos.map(c => c.nome);
  nomes.filter((n, i) => nomes.indexOf(n) !== i).forEach(n => erros.push(`Nome repetido: "${n}".`));
  return erros;
}

// ---------------------------------------------------------------- TOML (para o Git)
function paraToml({ projeto, comodos }) {
  const s = JSON.stringify;  // strings JSON são strings básicas válidas em TOML
  const linhas = ['# Gerado pelo formulário de pré-dimensionamento', '', '[projeto]'];
  for (const [k, v] of Object.entries(projeto)) linhas.push(`${k} = ${typeof v === 'string' ? s(v) : v}`);
  for (const c of comodos) {
    linhas.push('', '[[comodos]]');
    for (const k of ['nome', 'tipo', 'largura', 'comprimento', 'area', 'perimetro', 'distancia_quadro', 'tomadas']) {
      if (c[k] !== undefined) linhas.push(`${k} = ${typeof c[k] === 'string' ? s(c[k]) : c[k]}`);
    }
    for (const e of c.equipamentos ?? []) {
      linhas.push('', '  [[comodos.equipamentos]]', `  nome = ${s(e.nome)}`, `  potencia_w = ${e.potencia_w}`,
                  `  tensao = ${e.tensao}`, `  fp = ${e.fp}`);
    }
  }
  return linhas.join('\n') + '\n';
}

function preencher(dados) {
  const p = dados.projeto ?? {};
  $('#p-nome').value = p.nome ?? '';
  $('#p-cliente').value = p.cliente ?? '';
  $('#p-cidade').value = p.cidade ?? '';
  $('#p-alimentacao').value = p.alimentacao ?? 'bifasico';
  $('#p-tensao').value = p.tensao_fn === 220 ? '220-380' : '127-220';
  $('#p-temperatura').value = p.temperatura_ambiente ?? 35;
  $('#p-agrupamento').value = p.circuitos_por_eletroduto ?? 3;
  listaComodos.innerHTML = '';
  const ff = p.tensao_ff ?? 220;
  for (const c of dados.comodos ?? []) {
    adicionarComodo({
      nome: c.nome, tipo: c.tipo, largura: c.largura, comprimento: c.comprimento,
      area: c.area, perimetro: c.perimetro, distancia: c.distancia_quadro ?? c.distancia, tomadas: c.tomadas,
      equipamentos: (c.equipamentos ?? []).map(e => ({
        nome: e.nome, potencia: e.potencia_w ?? e.potencia, fp: e.fp ?? 1,
        tensao: (e.tensao === ff || e.tensao === 'ff') ? 'ff' : 'fn',
      })),
    });
  }
}

// ---------------------------------------------------------------- rascunho automático
function salvarRascunho() {
  try { localStorage.setItem('projeto-eletrico', JSON.stringify(lerFormulario())); } catch { /* sem armazenamento */ }
}
function abrirRascunho() {
  try {
    const salvo = JSON.parse(localStorage.getItem('projeto-eletrico'));
    if (salvo?.comodos?.length) { preencher(salvo); return true; }
  } catch { /* ignora */ }
  return false;
}

// ---------------------------------------------------------------- cálculo
function status(texto, erro = false) {
  const el = $('#status');
  el.textContent = texto;
  el.classList.toggle('erro', erro);
}

async function iniciarPython() {
  try {
    py = await loadPyodide();
    py.FS.mkdirTree('/home/pyodide/eletrica');
    for (const nome of ['__init__', 'norma', 'projeto', 'circuitos', 'materiais', 'unifilar', 'relatorio']) {
      const resp = await fetch(`eletrica/${nome}.py`);
      if (!resp.ok) throw new Error(`não achei eletrica/${nome}.py`);
      py.FS.writeFile(`/home/pyodide/eletrica/${nome}.py`, await resp.text());
    }
    py.runPython(PYTHON);
    $('#gerar').disabled = false;
    $('#gerar').textContent = 'Gerar projeto';
    status('Pronto. Preencha os cômodos e clique em "Gerar projeto".');
  } catch (erro) {
    status(`Não consegui carregar o cálculo: ${erro.message}. Verifique a internet e recarregue a página.`, true);
  }
}

function gerar() {
  const dados = lerFormulario();
  const erros = validar(dados);
  if (erros.length) { status(erros.join('\n'), true); return; }
  const r = JSON.parse(py.globals.get('rodar')(JSON.stringify(dados)));
  if (!r.ok) { status(r.erro, true); return; }
  ultimo = { ...r, toml: paraToml(dados), nome: dados.projeto.nome };
  $('#relatorio').srcdoc = r.html;
  $('#resultado').style.display = 'block';
  status(`✔ ${r.resumo}${r.avisos.length ? ' · ' + r.avisos.length + ' aviso(s) no relatório' : ''}`);
  $('#resultado').scrollIntoView({ behavior: 'smooth' });
}

function baixar(tipo) {
  if (!ultimo) return;
  const base = ultimo.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projeto';
  const arquivos = {
    relatorio: [ultimo.html, `${base}-relatorio.html`, 'text/html'],
    unifilar: [ultimo.svg, `${base}-unifilar.svg`, 'image/svg+xml'],
    materiais: ['﻿' + ultimo.csv, `${base}-materiais.csv`, 'text/csv'],
    toml: [ultimo.toml, `${base}.toml`, 'application/toml'],
  };
  const [conteudo, nome, tipoMime] = arquivos[tipo];
  const url = URL.createObjectURL(new Blob([conteudo], { type: `${tipoMime};charset=utf-8` }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------- eventos
listaComodos.addEventListener('input', e => {
  const comodo = e.target.closest('.comodo');
  if (comodo) atualizarCalculo(comodo);
  salvarRascunho();
});
listaComodos.addEventListener('change', e => {
  const comodo = e.target.closest('.comodo');
  if (e.target.dataset.acao === 'preset' && e.target.value !== '') {
    adicionarEquip(comodo, PRESETS[e.target.value]);
    e.target.value = '';
  }
  if (comodo) atualizarCalculo(comodo);
  salvarRascunho();
});
listaComodos.addEventListener('click', e => {
  const acao = e.target.dataset.acao;
  if (acao === 'remover-comodo') e.target.closest('.comodo').remove();
  if (acao === 'remover-equip') e.target.closest('.equip').remove();
  if (acao) salvarRascunho();
});
$$('#p-nome, #p-cliente, #p-cidade, #p-alimentacao, #p-tensao, #p-temperatura, #p-agrupamento')
  .forEach(el => el.addEventListener('change', salvarRascunho));

$('#add-comodo').addEventListener('click', () => { adicionarComodo().scrollIntoView({ behavior: 'smooth', block: 'center' }); salvarRascunho(); });
$('#carregar-exemplo').addEventListener('click', () => {
  if (listaComodos.children.length && !confirm('Substituir os cômodos atuais pela casa de exemplo?')) return;
  preencher({ projeto: { nome: 'Casa Exemplo', cliente: 'Família Silva', cidade: 'Boa Vista - RR' }, comodos: [] });
  EXEMPLO.forEach(c => adicionarComodo(c));
  salvarRascunho();
});
$('#abrir-toml').addEventListener('change', async e => {
  const arquivo = e.target.files[0];
  if (!arquivo || !py) return;
  try {
    preencher(JSON.parse(py.globals.get('ler_toml')(await arquivo.text())));
    salvarRascunho();
    status(`Arquivo ${arquivo.name} carregado.`);
  } catch (erro) {
    status(`Não consegui ler o arquivo: ${erro.message}`, true);
  }
  e.target.value = '';
});
$('#gerar').addEventListener('click', gerar);
$('#imprimir').addEventListener('click', () => $('#relatorio').contentWindow.print());
$$('[data-baixar]').forEach(b => b.addEventListener('click', () => baixar(b.dataset.baixar)));

if (!abrirRascunho()) adicionarComodo({ nome: 'Sala', tipo: 'sala' });
iniciarPython();
