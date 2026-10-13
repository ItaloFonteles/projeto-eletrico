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

// Mesma casa do projetos/casa-exemplo.toml, já posicionada na planta
const EXEMPLO_QUADRO = { x: 5.0, y: 5.15 };
const EXEMPLO = [
  { nome: 'Varanda', tipo: 'varanda', largura: 4, comprimento: 2, x: 0, y: 0 },
  { nome: 'Sala', tipo: 'sala', largura: 4.5, comprimento: 4, x: 0, y: 2, tomadas: 5 },
  { nome: 'Cozinha', tipo: 'cozinha', largura: 3.5, comprimento: 3, x: 4.5, y: 2,
    equipamentos: [{ nome: 'Micro-ondas', potencia: 1500, tensao: 'fn', fp: 1 },
                   { nome: 'Forno elétrico', potencia: 2000, tensao: 'ff', fp: 1 }] },
  { nome: 'Área de serviço', tipo: 'area_servico', largura: 2.5, comprimento: 2, x: 8, y: 2,
    equipamentos: [{ nome: 'Máquina de lavar', potencia: 1000, tensao: 'fn', fp: 1 }] },
  { nome: 'Corredor', tipo: 'corredor', largura: 4, comprimento: 1, x: 4.5, y: 5 },
  { nome: 'Quarto 1', tipo: 'dormitorio', largura: 3.2, comprimento: 3.2, x: 0, y: 6,
    equipamentos: [{ nome: 'Ar-condicionado 12.000 BTU', potencia: 1100, tensao: 'ff', fp: 0.9 }] },
  { nome: 'Banheiro social', tipo: 'banheiro', largura: 2, comprimento: 1.8, x: 3.2, y: 6,
    equipamentos: [{ nome: 'Chuveiro', potencia: 5500, tensao: 'ff', fp: 1 }] },
  { nome: 'Quarto 2 (suíte)', tipo: 'dormitorio', largura: 3.5, comprimento: 3.5, x: 5.2, y: 6,
    equipamentos: [{ nome: 'Ar-condicionado 12.000 BTU', potencia: 1100, tensao: 'ff', fp: 0.9 }] },
  { nome: 'Banheiro suíte', tipo: 'banheiro', largura: 2, comprimento: 1.6, x: 8.7, y: 6,
    equipamentos: [{ nome: 'Chuveiro', potencia: 5500, tensao: 'ff', fp: 1 }] },
];

const PYTHON = `
import base64, json, sys, tomllib
sys.path.insert(0, "/home/pyodide")
from eletrica.projeto import preparar, ErroProjeto
from eletrica import circuitos, dxf, materiais, planta, unifilar, relatorio

def rodar(entrada):
    try:
        dados = preparar(json.loads(entrada))
        dados["projeto"]["arquivo"] = "formulário web"
        res = circuitos.calcular(dados)
        lista = materiais.listar(dados, res)
        svg = unifilar.gerar(dados, res)
        planta_svg = planta.svg(dados, res)
        return json.dumps({"ok": True, "html": relatorio.html(dados, res, lista, svg, planta_svg), "svg": svg,
                           "planta": planta_svg, "dxf": base64.b64encode(dxf.gerar(dados, res)).decode(),
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
  $('[data-c=distancia]', el).value = c.distancia ?? '';
  $('[data-c=tomadas]', el).value = c.tomadas ?? '';
  if (c.x !== undefined && c.y !== undefined) { el.dataset.x = c.x; el.dataset.y = c.y; }
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
  if ($('#p-quadro-x').value !== '') {
    projeto.quadro_x = Number($('#p-quadro-x').value);
    projeto.quadro_y = Number($('#p-quadro-y').value);
  }
  const comodos = $$('.comodo', listaComodos).map(el => {
    const v = k => $(`[data-c=${k}]`, el).value;
    const c = {
      nome: v('nome').trim(), tipo: v('tipo'),
      area: Number(v('area')), perimetro: Number(v('perimetro')),
    };
    if (Number(v('distancia')) > 0) c.distancia_quadro = Number(v('distancia'));
    if (el.dataset.x !== undefined) { c.x = Number(el.dataset.x); c.y = Number(el.dataset.y); }
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
    for (const k of ['nome', 'tipo', 'largura', 'comprimento', 'area', 'perimetro', 'x', 'y', 'distancia_quadro', 'tomadas']) {
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
  $('#p-quadro-x').value = p.quadro_x ?? '';
  $('#p-quadro-y').value = p.quadro_y ?? '';
  listaComodos.innerHTML = '';
  const ff = p.tensao_ff ?? 220;
  for (const c of dados.comodos ?? []) {
    adicionarComodo({
      nome: c.nome, tipo: c.tipo, largura: c.largura, comprimento: c.comprimento, x: c.x, y: c.y,
      area: c.area, perimetro: c.perimetro, distancia: c.distancia_quadro ?? c.distancia, tomadas: c.tomadas,
      equipamentos: (c.equipamentos ?? []).map(e => ({
        nome: e.nome, potencia: e.potencia_w ?? e.potencia, fp: e.fp ?? 1,
        tensao: (e.tensao === ff || e.tensao === 'ff') ? 'ff' : 'fn',
      })),
    });
  }
  desenharEditor();
}

// ---------------------------------------------------------------- planta (editor de arrastar)
// Coordenadas em metros (viewBox do SVG em metros): origem no canto superior esquerdo, y para baixo.
const editor = $('#editor');
const ENCAIXE = 0.25;            // distância (m) em que a parede "gruda" na parede vizinha
const PASSO = 0.05;              // sem vizinho por perto, anda de 5 em 5 cm
const LARGURA_ARRUMACAO = 12;    // mesma regra da arrumação automática do Python
let arraste = null;

function medidas(el) {
  const v = k => parseFloat($(`[data-c=${k}]`, el).value);
  if (!$('[data-c=manual]', el).checked && v('largura') > 0 && v('comprimento') > 0) return [v('largura'), v('comprimento')];
  const lado = Math.round((Math.sqrt(v('area')) || 3) * 100) / 100;   // irregular: quadrado de mesma área
  return [lado, lado];
}

function arrumar(todos = false) {
  const els = $$('.comodo', listaComodos);
  if (todos) els.forEach(el => { delete el.dataset.x; delete el.dataset.y; });
  const fixos = els.filter(el => el.dataset.x !== undefined);
  let y = Math.max(0, ...fixos.map(el => Number(el.dataset.y) + medidas(el)[1]));
  let x = 0, alturaFila = 0;
  for (const el of els.filter(el => el.dataset.x === undefined)) {
    const [w, h] = medidas(el);
    if (x > 0 && x + w > LARGURA_ARRUMACAO) { x = 0; y += alturaFila; alturaFila = 0; }
    el.dataset.x = x.toFixed(2);
    el.dataset.y = y.toFixed(2);
    x += w;
    alturaFila = Math.max(alturaFila, h);
  }
}

function garantirQuadro(els) {
  if ($('#p-quadro-x').value !== '' || !els.length) return;
  const alvo = els.find(el => $('[data-c=tipo]', el).value === 'corredor') ?? els[0];
  $('#p-quadro-x').value = (Number(alvo.dataset.x) + 0.4).toFixed(2);
  $('#p-quadro-y').value = (Number(alvo.dataset.y) + 0.15).toFixed(2);
}

function caixas() {
  return $$('.comodo', listaComodos).map((el, i) => {
    const [w, h] = medidas(el);
    return { el, i, x: Number(el.dataset.x), y: Number(el.dataset.y), w, h, nome: $('[data-c=nome]', el).value || 'Cômodo' };
  });
}

function sobrepostos(lista) {
  const ruins = new Set();
  lista.forEach((a, i) => lista.slice(i + 1).forEach(b => {
    const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (dx > 0.05 && dy > 0.05) { ruins.add(a.i); ruins.add(b.i); }
  }));
  return ruins;
}

const escapar = t => t.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const br = n => String(Math.round(n * 100) / 100).replace('.', ',');

function desenharEditor() {
  if (arraste) return;               // durante o arraste o desenho é atualizado direto
  arrumar();
  const lista = caixas();
  garantirQuadro(lista.map(c => c.el));
  if (!lista.length) { editor.innerHTML = ''; editor.setAttribute('viewBox', '0 0 12 5'); return; }

  const qx = Number($('#p-quadro-x').value), qy = Number($('#p-quadro-y').value);
  const minx = Math.min(qx, ...lista.map(c => c.x)) - 1, miny = Math.min(qy, ...lista.map(c => c.y)) - 1;
  const maxx = Math.max(qx, ...lista.map(c => c.x + c.w)) + 2, maxy = Math.max(qy, ...lista.map(c => c.y + c.h)) + 2;
  const W = Math.max(12, maxx - minx), H = Math.max(7, maxy - miny);
  const ruins = sobrepostos(lista);

  const partes = [];
  for (let gx = Math.floor(minx); gx <= minx + W; gx++)
    partes.push(`<line x1="${gx}" y1="${miny}" x2="${gx}" y2="${miny + H}" stroke="#f0e8da" stroke-width="0.02"/>`);
  for (let gy = Math.floor(miny); gy <= miny + H; gy++)
    partes.push(`<line x1="${minx}" y1="${gy}" x2="${minx + W}" y2="${gy}" stroke="#f0e8da" stroke-width="0.02"/>`);
  for (const c of lista) {
    const fonte = Math.min(0.34, (c.w - 0.2) / (0.58 * c.nome.length));
    partes.push(`<g class="sala${ruins.has(c.i) ? ' sobreposto' : ''}" data-i="${c.i}" transform="translate(${c.x} ${c.y})">
      <rect width="${c.w}" height="${c.h}"/>
      <text x="${c.w / 2}" y="${c.h / 2}" text-anchor="middle" font-size="${fonte.toFixed(3)}" font-weight="700" fill="#24191a">${escapar(c.nome)}</text>
      <text x="${c.w / 2}" y="${c.h / 2 + 0.32}" text-anchor="middle" font-size="0.22" fill="#6b5d5f">${br(c.w)} × ${br(c.h)} m</text></g>`);
  }
  partes.push(`<g id="quadro" transform="translate(${qx} ${qy})"><rect x="-0.4" y="-0.15" width="0.8" height="0.3" fill="#7a1f2b"/>
    <text y="0.09" text-anchor="middle" font-size="0.2" font-weight="700" fill="#fff">QD</text></g>`);
  editor.setAttribute('viewBox', `${minx} ${miny} ${W} ${H}`);
  editor.innerHTML = partes.join('');
}

function pontoNoSvg(evt) {
  const p = editor.createSVGPoint();
  p.x = evt.clientX;
  p.y = evt.clientY;
  return p.matrixTransform(editor.getScreenCTM().inverse());
}

function encaixar(el, x, y, w, h) {
  const outros = caixas().filter(c => c.el !== el);
  const ajustar = (v, tam, bordas) => {
    let melhor = null, menor = ENCAIXE;
    for (const b of bordas) for (const cand of [b, b - tam]) {
      if (Math.abs(v - cand) < menor) { menor = Math.abs(v - cand); melhor = cand; }
    }
    return melhor ?? Math.round(v / PASSO) * PASSO;
  };
  return [ajustar(x, w, outros.flatMap(o => [o.x, o.x + o.w])), ajustar(y, h, outros.flatMap(o => [o.y, o.y + o.h]))];
}

editor.addEventListener('pointerdown', e => {
  const g = e.target.closest('.sala, #quadro');
  if (!g) return;
  const p = pontoNoSvg(e);
  if (g.id === 'quadro') {
    arraste = { g, quadro: true, ox: p.x - Number($('#p-quadro-x').value), oy: p.y - Number($('#p-quadro-y').value) };
  } else {
    const el = $$('.comodo', listaComodos)[Number(g.dataset.i)];
    arraste = { g, el, ox: p.x - Number(el.dataset.x), oy: p.y - Number(el.dataset.y) };
    g.classList.add('arrastando');
  }
  editor.setPointerCapture(e.pointerId);
  e.preventDefault();
});

editor.addEventListener('pointermove', e => {
  if (!arraste) return;
  const p = pontoNoSvg(e);
  let x = p.x - arraste.ox, y = p.y - arraste.oy;
  if (arraste.quadro) {
    x = Math.round(x / PASSO) * PASSO;
    y = Math.round(y / PASSO) * PASSO;
    $('#p-quadro-x').value = x.toFixed(2);
    $('#p-quadro-y').value = y.toFixed(2);
  } else {
    [x, y] = encaixar(arraste.el, x, y, ...medidas(arraste.el));
    arraste.el.dataset.x = x.toFixed(2);
    arraste.el.dataset.y = y.toFixed(2);
  }
  arraste.g.setAttribute('transform', `translate(${x} ${y})`);
  arraste.moveu = true;
});

// Toque duplo (ou clique duplo) num cômodo: gira 90°, trocando largura e comprimento.
// Feito à mão porque o "dblclick" não existe no celular.
let ultimoToque = { el: null, quando: 0 };
function girar(el) {
  if ($('[data-c=manual]', el).checked) return;
  const l = $('[data-c=largura]', el), c = $('[data-c=comprimento]', el);
  [l.value, c.value] = [c.value, l.value];
  atualizarCalculo(el);
}

function soltar() {
  if (!arraste) return;
  const { el, moveu, g } = arraste;
  g.classList.remove('arrastando');
  arraste = null;
  if (!moveu && el) {
    const agora = Date.now();
    if (ultimoToque.el === el && agora - ultimoToque.quando < 400) {
      girar(el);
      ultimoToque = { el: null, quando: 0 };
    } else {
      ultimoToque = { el, quando: agora };
      return;                                  // só um toque: nada mudou, não precisa redesenhar
    }
  }
  desenharEditor();
  salvarRascunho();
}
editor.addEventListener('pointerup', soltar);
editor.addEventListener('pointercancel', soltar);

$('#arrumar').addEventListener('click', () => { arrumar(true); desenharEditor(); salvarRascunho(); });

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
    for (const nome of ['__init__', 'norma', 'planta', 'projeto', 'circuitos', 'materiais', 'unifilar', 'dxf', 'relatorio']) {
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
  arquivos.planta = [ultimo.planta, `${base}-planta.svg`, 'image/svg+xml'];
  // DXF vem em base64 (bytes em ANSI/cp1252, a codificação que o AutoCAD espera num DXF R12)
  arquivos.dxf = [Uint8Array.from(atob(ultimo.dxf), ch => ch.charCodeAt(0)), `${base}.dxf`, 'application/dxf'];
  const [conteudo, nome, tipoMime] = arquivos[tipo];
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo === 'dxf' ? tipoMime : `${tipoMime};charset=utf-8` }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------- eventos
listaComodos.addEventListener('input', e => {
  const comodo = e.target.closest('.comodo');
  if (comodo) atualizarCalculo(comodo);
  desenharEditor();
  salvarRascunho();
});
listaComodos.addEventListener('change', e => {
  const comodo = e.target.closest('.comodo');
  if (e.target.dataset.acao === 'preset' && e.target.value !== '') {
    adicionarEquip(comodo, PRESETS[e.target.value]);
    e.target.value = '';
  }
  if (comodo) atualizarCalculo(comodo);
  desenharEditor();
  salvarRascunho();
});
listaComodos.addEventListener('click', e => {
  const acao = e.target.dataset.acao;
  if (acao === 'remover-comodo') e.target.closest('.comodo').remove();
  if (acao === 'remover-equip') e.target.closest('.equip').remove();
  if (acao) { desenharEditor(); salvarRascunho(); }
});
$$('#p-nome, #p-cliente, #p-cidade, #p-alimentacao, #p-tensao, #p-temperatura, #p-agrupamento')
  .forEach(el => el.addEventListener('change', salvarRascunho));

$('#add-comodo').addEventListener('click', () => {
  const el = adicionarComodo();
  desenharEditor();
  salvarRascunho();
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
$('#carregar-exemplo').addEventListener('click', () => {
  if (listaComodos.children.length && !confirm('Substituir os cômodos atuais pela casa de exemplo?')) return;
  preencher({ projeto: { nome: 'Casa Exemplo', cliente: 'Família Silva', cidade: 'Boa Vista - RR',
                         quadro_x: EXEMPLO_QUADRO.x, quadro_y: EXEMPLO_QUADRO.y }, comodos: [] });
  EXEMPLO.forEach(c => adicionarComodo(c));
  desenharEditor();
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
// No celular, mandar imprimir o iframe imprime a página inteira (com o formulário).
// Por isso o relatório abre sozinho numa página própria, que já chama a impressão.
$('#imprimir').addEventListener('click', () => {
  if (!ultimo) return;
  const paraImprimir = ultimo.html.replace('</body>',
    '<script>window.addEventListener("load", () => setTimeout(() => window.print(), 400));<\/script></body>');
  const url = URL.createObjectURL(new Blob([paraImprimir], { type: 'text/html;charset=utf-8' }));
  const janela = window.open(url, '_blank');
  if (!janela) location.href = url;       // bloqueador de pop-up: abre na mesma aba (o "voltar" retorna ao formulário)
  setTimeout(() => URL.revokeObjectURL(url), 60000);
});
$$('[data-baixar]').forEach(b => b.addEventListener('click', () => baixar(b.dataset.baixar)));

if (!abrirRascunho()) adicionarComodo({ nome: 'Sala', tipo: 'sala' });
desenharEditor();
iniciarPython();
