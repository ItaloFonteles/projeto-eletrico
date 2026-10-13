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

def pontos_planta(entrada):
    """Só a posição dos pontos, para o editor mostrar enquanto a casa é montada."""
    try:
        dados = preparar(json.loads(entrada))
        info = planta.pontos(dados, circuitos.calcular(dados))
        return json.dumps({"ok": True, "itens": info["itens"]})
    except Exception:
        return json.dumps({"ok": False})

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

const lerJson = (el, chave) => { try { return JSON.parse(el.dataset[chave] || '[]'); } catch { return []; } };
const gravarJson = (el, chave, valor) => { el.dataset[chave] = JSON.stringify(valor); };

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
  gravarJson(el, 'aberturas', c.aberturas ?? []);
  gravarJson(el, 'pontos', c.pontos ?? []);
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
    const aberturas = lerJson(el, 'aberturas');
    if (aberturas.length) c.aberturas = aberturas;
    const pontos = lerJson(el, 'pontos');
    if (pontos.length) c.pontos = pontos;
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
function valorToml(v) {
  return typeof v === 'string' ? JSON.stringify(v) : String(v);   // strings JSON são strings básicas válidas em TOML
}
const tabelaInline = obj => `{ ${Object.entries(obj).map(([k, v]) => `${k} = ${valorToml(v)}`).join(', ')} }`;

function paraToml({ projeto, comodos }) {
  const linhas = ['# Gerado pelo formulário de pré-dimensionamento', '', '[projeto]'];
  for (const [k, v] of Object.entries(projeto)) linhas.push(`${k} = ${valorToml(v)}`);
  for (const c of comodos) {
    linhas.push('', '[[comodos]]');
    for (const k of ['nome', 'tipo', 'largura', 'comprimento', 'area', 'perimetro', 'x', 'y', 'distancia_quadro', 'tomadas']) {
      if (c[k] !== undefined) linhas.push(`${k} = ${valorToml(c[k])}`);
    }
    for (const lista of ['aberturas', 'pontos']) {
      if (c[lista]?.length) linhas.push(`${lista} = [`, ...c[lista].map(a => `  ${tabelaInline(a)},`), ']');
    }
    for (const e of c.equipamentos ?? []) {
      linhas.push('', '  [[comodos.equipamentos]]', `  nome = ${valorToml(e.nome)}`, `  potencia_w = ${e.potencia_w}`,
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
  selecionado = null;
  const ff = p.tensao_ff ?? 220;
  for (const c of dados.comodos ?? []) {
    adicionarComodo({
      nome: c.nome, tipo: c.tipo, largura: c.largura, comprimento: c.comprimento, x: c.x, y: c.y,
      area: c.area, perimetro: c.perimetro, distancia: c.distancia_quadro ?? c.distancia, tomadas: c.tomadas,
      aberturas: c.aberturas, pontos: c.pontos,
      equipamentos: (c.equipamentos ?? []).map(e => ({
        nome: e.nome, potencia: e.potencia_w ?? e.potencia, fp: e.fp ?? 1,
        tensao: (e.tensao === ff || e.tensao === 'ff') ? 'ff' : 'fn',
      })),
    });
  }
  desenharEditor();
}

// ---------------------------------------------------------------- planta (editor)
// Coordenadas em metros (viewBox do SVG em metros): origem no canto superior esquerdo, y para baixo.
// Paredes: N (cima), L (direita), S (baixo), O (esquerda) — iguais às do Python (eletrica/planta.py).
const editor = $('#editor');
const ferramentas = $('#ferramentas');
const ENCAIXE = 0.25;            // distância (m) em que a parede "gruda" na parede vizinha
const PASSO = 0.05;              // sem vizinho por perto, anda de 5 em 5 cm
const RECUO = 0.15;              // tomadas e interruptores ficam 15 cm para dentro da parede (desenho)
const LARGURA_ARRUMACAO = 12;    // mesma regra da arrumação automática do Python
const DENTRO = { N: [0, 1], S: [0, -1], L: [-1, 0], O: [1, 0] };
let arraste = null;
let selecionado = null;          // { tipo: 'comodo', el } | { tipo: 'abertura', el, k }
let pontosAtuais = [];

const arred = v => Math.round(v * 100) / 100;
const brn = n => String(arred(n)).replace('.', ',');

function medidas(el) {
  const v = k => parseFloat($(`[data-c=${k}]`, el).value);
  if (!$('[data-c=manual]', el).checked && v('largura') > 0 && v('comprimento') > 0) return [v('largura'), v('comprimento')];
  const lado = arred(Math.sqrt(v('area')) || 3);   // irregular: quadrado de mesma área
  return [lado, lado];
}

function comprimentoParede(el, parede) {
  const [w, h] = medidas(el);
  return parede === 'N' || parede === 'S' ? w : h;
}

function pontoNaParede(w, h, parede, s, recuo = 0) {
  return { N: [s, recuo], S: [s, h - recuo], O: [recuo, s], L: [w - recuo, s] }[parede];
}

function paredeMaisProxima(w, h, lx, ly) {
  const d = { N: ly, S: h - ly, O: lx, L: w - lx };
  const parede = Object.keys(d).reduce((a, b) => (d[a] <= d[b] ? a : b));
  const s = parede === 'N' || parede === 'S' ? lx : ly;
  return { parede, s: Math.min(Math.max(s, 0), parede === 'N' || parede === 'S' ? w : h) };
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

const escapar = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function atualizarPontos() {
  if (!py) { pontosAtuais = []; return; }
  const dados = lerFormulario();
  if (validar(dados).length) { pontosAtuais = []; return; }
  const r = JSON.parse(py.globals.get('pontos_planta')(JSON.stringify(dados)));
  pontosAtuais = r.ok ? r.itens : [];
}

function svgAbertura(c, a, k) {
  const [ax, ay] = pontoNaParede(c.w, c.h, a.parede, a.inicio);
  const [bx, by] = pontoNaParede(c.w, c.h, a.parede, a.inicio + a.largura);
  const [dx, dy] = DENTRO[a.parede];
  const sel = selecionado?.tipo === 'abertura' && selecionado.el === c.el && selecionado.k === k;
  const cor = sel ? '#c9a24b' : (a.tipo === 'janela' ? '#1f4e8c' : '#24191a');
  let s = `<g class="abertura" data-i="${c.i}" data-k="${k}">`;
  // área de toque maior que o desenho, para conseguir pegar com o dedo
  s += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="transparent" stroke-width="0.45"/>`;
  if (a.tipo === 'janela') {
    const t = 0.07;
    s += `<polygon points="${ax - dx * t},${ay - dy * t} ${bx - dx * t},${by - dy * t} ${bx + dx * t},${by + dy * t} ${ax + dx * t},${ay + dy * t}" fill="#dbe9f6" stroke="${cor}" stroke-width="0.03"/>`;
  } else {
    s += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#fff" stroke-width="0.1"/>`;
    if (a.folha !== false) {
      const ux = (bx - ax) / a.largura, uy = (by - ay) / a.largura;
      const pts = [];
      for (let j = 0; j <= 10; j++) {
        const t = Math.PI / 2 * j / 10;
        pts.push(`${ax + a.largura * (ux * Math.cos(t) + dx * Math.sin(t))},${ay + a.largura * (uy * Math.cos(t) + dy * Math.sin(t))}`);
      }
      s += `<line x1="${ax}" y1="${ay}" x2="${ax + dx * a.largura}" y2="${ay + dy * a.largura}" stroke="${cor}" stroke-width="0.035"/>`;
      s += `<polyline points="${pts.join(' ')}" fill="none" stroke="${sel ? cor : '#6b5d5f'}" stroke-width="0.02" stroke-dasharray="0.08 0.06"/>`;
    } else if (sel) {
      s += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${cor}" stroke-width="0.06"/>`;
    }
  }
  return s + '</g>';
}

function svgPonto(p) {
  const borda = p.manual ? 'stroke-dasharray="0.05 0.03"' : '';
  let s = `<g class="ponto" data-comodo="${escapar(p.comodo)}" data-tipo="${p.tipo}" data-indice="${p.indice}" transform="translate(${p.x} ${p.y})">`;
  s += `<circle r="0.28" fill="transparent"/>`;                 // área de toque
  if (p.tipo === 'luz') {
    s += `<circle r="0.15" fill="#fff" stroke="#7a1f2b" stroke-width="0.04" ${borda}/><path d="M-0.1 -0.1L0.1 0.1M-0.1 0.1L0.1 -0.1" stroke="#7a1f2b" stroke-width="0.035"/>`;
  } else if (p.tipo === 'interruptor') {
    s += `<circle r="0.08" fill="#24191a"/>`;
  } else {
    const [dx, dy] = DENTRO[p.lado], [ox, oy] = [-dy, dx], t = 0.13;
    s += `<polygon points="${ox * t},${oy * t} ${-ox * t},${-oy * t} ${dx * t * 1.4},${dy * t * 1.4}" fill="${p.tipo === 'tue' ? '#1f4e8c' : '#fff'}" stroke="#1f4e8c" stroke-width="0.035" ${borda}/>`;
  }
  if (p.circuito) s += `<text x="0.18" y="-0.12" font-size="0.18" font-weight="700" fill="#7a1f2b">${p.circuito}</text>`;
  return s + '</g>';
}

function desenharEditor() {
  if (arraste) return;               // durante o arraste o desenho é atualizado direto
  arrumar();
  const lista = caixas();
  garantirQuadro(lista.map(c => c.el));
  if (!lista.length) { editor.innerHTML = ''; editor.setAttribute('viewBox', '0 0 12 5'); desenharFerramentas(); return; }
  atualizarPontos();

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
    const fonte = Math.min(0.32, (c.w - 0.2) / (0.58 * c.nome.length));
    const sel = selecionado?.tipo === 'comodo' && selecionado.el === c.el;
    partes.push(`<g class="sala${ruins.has(c.i) ? ' sobreposto' : ''}${sel ? ' selecionado' : ''}" data-i="${c.i}" transform="translate(${c.x} ${c.y})">
      <rect width="${c.w}" height="${c.h}"/>
      <text x="${c.w / 2}" y="${c.h * 0.3 + 0.1}" text-anchor="middle" font-size="${fonte.toFixed(3)}" font-weight="700" fill="#24191a">${escapar(c.nome)}</text>
      <text x="${c.w / 2}" y="${c.h * 0.3 + 0.38}" text-anchor="middle" font-size="0.2" fill="#6b5d5f">${brn(c.w)} × ${brn(c.h)} m</text>
      ${lerJson(c.el, 'aberturas').map((a, k) => svgAbertura(c, a, k)).join('')}</g>`);
  }
  partes.push(...pontosAtuais.map(svgPonto));
  partes.push(`<g id="quadro" transform="translate(${qx} ${qy})"><rect x="-0.4" y="-0.15" width="0.8" height="0.3" fill="#7a1f2b"/>
    <text y="0.09" text-anchor="middle" font-size="0.2" font-weight="700" fill="#fff">QD</text></g>`);
  editor.setAttribute('viewBox', `${minx} ${miny} ${W} ${H}`);
  editor.innerHTML = partes.join('');
  desenharFerramentas();
}

// ------------------------------- barra de ferramentas do item selecionado
function desenharFerramentas() {
  if (selecionado && !selecionado.el.isConnected) selecionado = null;
  if (!selecionado) {
    ferramentas.innerHTML = '<span class="dica">Toque num cômodo para adicionar portas e janelas. Arraste tomadas, interruptores e luzes para onde quiser.</span>';
    return;
  }
  const nome = escapar($('[data-c=nome]', selecionado.el).value || 'Cômodo');
  if (selecionado.tipo === 'comodo') {
    const temManual = lerJson(selecionado.el, 'pontos').length > 0;
    ferramentas.innerHTML = `<b>${nome}:</b>
      <button type="button" class="secundario" data-f="porta">+ Porta</button>
      <button type="button" class="secundario" data-f="janela">+ Janela</button>
      <button type="button" class="secundario" data-f="girar">Girar 90°</button>
      ${temManual ? '<button type="button" class="secundario" data-f="automatico">Voltar pontos para o automático</button>' : ''}`;
    return;
  }
  const a = lerJson(selecionado.el, 'aberturas')[selecionado.k];
  const larguras = a.tipo === 'porta' ? [0.6, 0.7, 0.8, 0.9, 1.0, 1.2] : [0.6, 0.8, 1.0, 1.2, 1.5, 2.0];
  ferramentas.innerHTML = `<b>${a.tipo === 'porta' ? 'Porta' : 'Janela'} · ${nome}:</b>
    <label style="flex-direction:row;align-items:center;gap:6px">Largura
      <select data-f="largura">${larguras.map(l => `<option value="${l}"${Math.abs(l - a.largura) < 0.001 ? ' selected' : ''}>${brn(l)} m</option>`).join('')}</select></label>
    ${a.tipo === 'porta' ? `<button type="button" class="secundario" data-f="folha">${a.folha === false ? 'Mostrar folha (abre para este lado)' : 'Só o vão (abre para o outro lado)'}</button>` : ''}
    <button type="button" class="remover" data-f="remover-abertura">Remover</button>`;
}

function salvarAbertura(el, k, mudar) {
  const lista = lerJson(el, 'aberturas');
  lista[k] = mudar(lista[k]);
  gravarJson(el, 'aberturas', lista);
}

ferramentas.addEventListener('click', e => {
  const f = e.target.dataset.f;
  if (!f || !selecionado) return;
  const el = selecionado.el;
  if (f === 'porta' || f === 'janela') {
    const parede = f === 'porta' ? 'S' : 'N';
    const comp = comprimentoParede(el, parede);
    const largura = Math.min(f === 'porta' ? 0.8 : 1.2, comp - 0.1);
    const lista = lerJson(el, 'aberturas');
    lista.push({ tipo: f, parede, inicio: arred((comp - largura) / 2), largura });
    gravarJson(el, 'aberturas', lista);
    selecionado = { tipo: 'abertura', el, k: lista.length - 1 };
  } else if (f === 'girar') {
    girar(el);
  } else if (f === 'automatico') {
    gravarJson(el, 'pontos', []);
  } else if (f === 'folha') {
    salvarAbertura(el, selecionado.k, a => ({ ...a, folha: a.folha === false ? undefined : false }));
  } else if (f === 'remover-abertura') {
    const lista = lerJson(el, 'aberturas');
    lista.splice(selecionado.k, 1);
    gravarJson(el, 'aberturas', lista);
    selecionado = { tipo: 'comodo', el };
  } else {
    return;
  }
  desenharEditor();
  salvarRascunho();
});

ferramentas.addEventListener('change', e => {
  if (e.target.dataset.f !== 'largura' || selecionado?.tipo !== 'abertura') return;
  const { el, k } = selecionado;
  salvarAbertura(el, k, a => {
    const largura = Number(e.target.value);
    const comp = comprimentoParede(el, a.parede);
    return { ...a, largura: Math.min(largura, comp), inicio: arred(Math.min(a.inicio, Math.max(0, comp - largura))) };
  });
  desenharEditor();
  salvarRascunho();
});

// ------------------------------- girar 90° (sentido horário), levando portas, janelas e pontos junto
function girar(el) {
  if ($('[data-c=manual]', el).checked) return;
  const [w, h] = medidas(el);
  const l = $('[data-c=largura]', el), c = $('[data-c=comprimento]', el);
  [l.value, c.value] = [c.value, l.value];
  // ponto (u, v) num cômodo w×h vai para (h − v, u) no cômodo h×w
  gravarJson(el, 'aberturas', lerJson(el, 'aberturas').map(a => {
    const nova = { N: ['L', a.inicio], L: ['S', h - a.inicio - a.largura], S: ['O', a.inicio], O: ['N', h - a.inicio - a.largura] }[a.parede];
    return { ...a, parede: nova[0], inicio: arred(nova[1]) };
  }));
  gravarJson(el, 'pontos', lerJson(el, 'pontos').map(p => ({ ...p, x: arred(h - p.y), y: arred(p.x) })));
  atualizarCalculo(el);
}

// ------------------------------- arrastar e tocar
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

const comodoPorNome = nome => $$('.comodo', listaComodos).find(el => $('[data-c=nome]', el).value.trim() === nome);

// Zoom: aumenta a largura do desenho dentro da caixa (que rola); arrastar o fundo move a vista.
const caixaEditor = editor.parentElement;
const ZOOMS = [1, 1.6, 2.4, 3.2];
let zoom = 0;
function aplicarZoom(passo) {
  const centroX = (caixaEditor.scrollLeft + caixaEditor.clientWidth / 2) / caixaEditor.scrollWidth;
  const centroY = (caixaEditor.scrollTop + caixaEditor.clientHeight / 2) / caixaEditor.scrollHeight;
  zoom = Math.min(Math.max(zoom + passo, 0), ZOOMS.length - 1);
  editor.style.width = `${ZOOMS[zoom] * 100}%`;
  caixaEditor.scrollLeft = centroX * caixaEditor.scrollWidth - caixaEditor.clientWidth / 2;
  caixaEditor.scrollTop = centroY * caixaEditor.scrollHeight - caixaEditor.clientHeight / 2;
}
$('#zoom-mais').addEventListener('click', () => aplicarZoom(1));
$('#zoom-menos').addEventListener('click', () => aplicarZoom(-1));

editor.addEventListener('pointerdown', e => {
  const alvo = e.target.closest('.ponto, .abertura, #quadro, .sala');
  if (!alvo) {
    // fundo: move a vista (a caixa; se ela não tiver para onde rolar, a página)
    arraste = { tipo: 'vista', sx: e.clientX, sy: e.clientY, sl: caixaEditor.scrollLeft, st: caixaEditor.scrollTop, wy: window.scrollY };
    editor.classList.add('movendo-vista');
    editor.setPointerCapture(e.pointerId);
    return;
  }
  const p = pontoNoSvg(e);
  if (alvo.id === 'quadro') {
    arraste = { tipo: 'quadro', g: alvo, ox: p.x - Number($('#p-quadro-x').value), oy: p.y - Number($('#p-quadro-y').value) };
  } else if (alvo.classList.contains('ponto')) {
    arraste = { tipo: 'ponto', g: alvo, el: comodoPorNome(alvo.dataset.comodo), ponto: alvo.dataset };
  } else if (alvo.classList.contains('abertura')) {
    const el = $$('.comodo', listaComodos)[Number(alvo.dataset.i)];
    arraste = { tipo: 'abertura', g: alvo, el, k: Number(alvo.dataset.k) };
  } else {
    const el = $$('.comodo', listaComodos)[Number(alvo.dataset.i)];
    arraste = { tipo: 'comodo', g: alvo, el, ox: p.x - Number(el.dataset.x), oy: p.y - Number(el.dataset.y) };
    alvo.classList.add('arrastando');
  }
  editor.setPointerCapture(e.pointerId);
  e.preventDefault();
});

editor.addEventListener('pointermove', e => {
  if (!arraste) return;
  const a = arraste;
  if (a.tipo === 'vista') {
    const dx = e.clientX - a.sx, dy = e.clientY - a.sy;
    if (Math.abs(dx) + Math.abs(dy) > 4) a.moveu = true;
    caixaEditor.scrollLeft = a.sl - dx;
    const podeRolar = caixaEditor.scrollHeight > caixaEditor.clientHeight;
    if (podeRolar) caixaEditor.scrollTop = a.st - dy;
    else window.scrollTo(window.scrollX, a.wy - dy);
    return;
  }
  const p = pontoNoSvg(e);
  if (a.tipo === 'quadro') {
    const x = Math.round((p.x - a.ox) / PASSO) * PASSO, y = Math.round((p.y - a.oy) / PASSO) * PASSO;
    $('#p-quadro-x').value = x.toFixed(2);
    $('#p-quadro-y').value = y.toFixed(2);
    a.g.setAttribute('transform', `translate(${x} ${y})`);
  } else if (a.tipo === 'comodo') {
    const [x, y] = encaixar(a.el, p.x - a.ox, p.y - a.oy, ...medidas(a.el));
    a.el.dataset.x = x.toFixed(2);
    a.el.dataset.y = y.toFixed(2);
    a.g.setAttribute('transform', `translate(${x} ${y})`);
  } else if (a.tipo === 'abertura') {
    // a porta/janela corre pelas paredes do próprio cômodo
    const [w, h] = medidas(a.el);
    const lx = p.x - Number(a.el.dataset.x), ly = p.y - Number(a.el.dataset.y);
    const { parede, s } = paredeMaisProxima(w, h, lx, ly);
    salvarAbertura(a.el, a.k, ab => {
      const comp = parede === 'N' || parede === 'S' ? w : h;
      const largura = Math.min(ab.largura, comp);
      return { ...ab, parede, largura, inicio: arred(Math.min(Math.max(s - largura / 2, 0), comp - largura)) };
    });
    const g = a.g.closest('.sala');
    const c = caixas().find(cx => cx.el === a.el);
    a.g.outerHTML = svgAbertura(c, lerJson(a.el, 'aberturas')[a.k], a.k);
    a.g = $(`.abertura[data-i="${c.i}"][data-k="${a.k}"]`, g);
  } else if (a.tipo === 'ponto') {
    const [w, h] = medidas(a.el);
    let lx = Math.min(Math.max(p.x - Number(a.el.dataset.x), 0), w);
    let ly = Math.min(Math.max(p.y - Number(a.el.dataset.y), 0), h);
    if (a.ponto.tipo !== 'luz') {                 // tomadas e interruptores grudam na parede
      const { parede, s } = paredeMaisProxima(w, h, lx, ly);
      [lx, ly] = pontoNaParede(w, h, parede, s, RECUO);
    }
    a.local = [arred(lx), arred(ly)];
    a.g.setAttribute('transform', `translate(${Number(a.el.dataset.x) + lx} ${Number(a.el.dataset.y) + ly})`);
  }
  a.moveu = true;
});

// Toque duplo num cômodo: gira 90° (feito à mão porque o "dblclick" não existe no celular)
let ultimoToque = { el: null, quando: 0 };

function soltar() {
  if (!arraste) return;
  const a = arraste;
  a.g?.classList?.remove('arrastando');
  arraste = null;
  if (a.tipo === 'vista') {
    editor.classList.remove('movendo-vista');
    if (!a.moveu && selecionado) { selecionado = null; desenharEditor(); }   // toque no fundo: desmarca
    return;
  }
  if (a.tipo === 'ponto' && a.moveu && a.local) {
    const lista = lerJson(a.el, 'pontos').filter(p => !(p.tipo === a.ponto.tipo && p.indice === Number(a.ponto.indice)));
    lista.push({ tipo: a.ponto.tipo, indice: Number(a.ponto.indice), x: a.local[0], y: a.local[1] });
    gravarJson(a.el, 'pontos', lista);
  }
  if (!a.moveu) {
    if (a.tipo === 'abertura') selecionado = { tipo: 'abertura', el: a.el, k: a.k };
    if (a.tipo === 'comodo') {
      const agora = Date.now();
      if (ultimoToque.el === a.el && agora - ultimoToque.quando < 400) {
        girar(a.el);
        ultimoToque = { el: null, quando: 0 };
      } else {
        ultimoToque = { el: a.el, quando: agora };
      }
      selecionado = { tipo: 'comodo', el: a.el };
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
    desenharEditor();                    // agora com os pontos calculados
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
  const base = ultimo.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projeto';
  const arquivos = {
    relatorio: [ultimo.html, `${base}-relatorio.html`, 'text/html'],
    planta: [ultimo.planta, `${base}-planta.svg`, 'image/svg+xml'],
    unifilar: [ultimo.svg, `${base}-unifilar.svg`, 'image/svg+xml'],
    materiais: ['﻿' + ultimo.csv, `${base}-materiais.csv`, 'text/csv'],
    toml: [ultimo.toml, `${base}.toml`, 'application/toml'],
    // DXF vem em base64 (bytes em ANSI/cp1252, a codificação que o AutoCAD espera num DXF R12)
    dxf: [Uint8Array.from(atob(ultimo.dxf), ch => ch.charCodeAt(0)), `${base}.dxf`, 'application/dxf'],
  };
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
  .forEach(el => el.addEventListener('change', () => { desenharEditor(); salvarRascunho(); }));

$('#add-comodo').addEventListener('click', () => {
  const el = adicionarComodo();
  desenharEditor();
  salvarRascunho();
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
$('#carregar-exemplo').addEventListener('click', async () => {
  if (!py) { status('Aguarde o cálculo terminar de carregar…'); return; }
  if (listaComodos.children.length && !confirm('Substituir os cômodos atuais pela casa de exemplo?')) return;
  // o mesmo arquivo usado pela linha de comando: uma casa de exemplo só
  const texto = await (await fetch('projetos/casa-exemplo.toml')).text();
  preencher(JSON.parse(py.globals.get('ler_toml')(texto)));
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
