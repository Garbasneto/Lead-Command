import { ETAPA_NOME, ETAPAS_ABERTAS, OBJ } from '@/lib/etapas';
import { fmt, ND } from '@/lib/formato';
import type { Visao } from '@/lib/metricas/computar';
import { clamp, ease, lerp } from '@/lib/util';
import { el, type Ambiente } from './ambiente';
import type { Painel } from './contexto';
import { sparkline } from './desenho';

/* ================= efeitos de número ================= */
export function countTo(amb: Ambiente, elm: Element, v: number | null, f: (v: number) => string, anim: boolean, delay?: number) {
  const s = amb.contadores.get(elm) || { tok: 0, v: null };
  amb.contadores.set(elm, s);
  s.tok++; const tk = s.tok;
  if (v == null || !isFinite(v)) { elm.textContent = ND; s.v = null; return; }
  const from = s.v != null && isFinite(s.v) ? s.v : 0;
  s.v = v;
  if (!anim || amb.REDUCED) { elm.textContent = f(v); return; }
  const t0 = performance.now() + (delay || 0), D = 1100;
  const step = (now: number) => {
    if (s.tok !== tk) return;
    const p = clamp((now - t0) / D, 0, 1);
    elm.textContent = f(lerp(from, v, ease.out(p)));
    if (p < 1) amb.raf(step);
  };
  amb.raf(step);
}
export function spot(amb: Ambiente, elm: HTMLElement, signal?: AbortSignal) {
  if (!amb.FINE || amb.REDUCED) return;
  elm.addEventListener('pointermove', e => { const r = elm.getBoundingClientRect(); elm.style.setProperty('--mx', (e.clientX - r.left) + 'px'); elm.style.setProperty('--my', (e.clientY - r.top) + 'px'); }, { signal });
}
function tilt(amb: Ambiente, elm: HTMLElement) {
  if (!amb.FINE || amb.REDUCED) return;
  elm.addEventListener('pointermove', e => { const r = elm.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; elm.style.transform = `perspective(900px) rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg)`; });
  elm.addEventListener('pointerleave', () => { elm.style.transform = ''; });
}
function vazio(msg: string) { return el('div', 'empty', msg); }

/* ================= renderização ================= */
function deltaEl(cur: number | null, prev: number | null | undefined, bom: 'up' | 'down' | null, curto?: boolean) {
  const span = el('span');
  if (prev == null || cur == null || !(prev > 0)) { span.className = 'flat'; span.textContent = curto ? 'sem comparação' : 'sem período anterior para comparar'; return span; }
  const d = (cur - prev) / prev, up = d > .0005, down = d < -.0005;
  const b = el('b', !bom || (!up && !down) ? 'flat' : ((up && bom === 'up') || (down && bom === 'down')) ? 'good' : 'bad', `${up ? '▲' : down ? '▼' : '='} ${fmt.pct(Math.abs(d))}`);
  span.append(b, document.createTextNode(curto ? ' vs anterior' : ' vs período anterior'));
  return span;
}
function setSub(P: Painel, id: string, node: Node) { const e = P.amb.$(id); e.textContent = ''; e.append(node); }
export function desenharSparkHero(P: Painel, anim: boolean) { if (P.sparkVals) sparkline(P.amb, P.amb.$<HTMLCanvasElement>('#kSpark'), P.sparkVals, '#cfe6e2', anim); }

export function renderKPIs(P: Painel, V: Visao, anim: boolean) {
  const { amb } = P, { $, SRC } = amb;
  $('#chipPer').textContent = `${V.periodo} dias`;
  countTo(amb, $('#kLeads'), V.TL.leads, fmt.int, anim, 0);
  const sp = $('#kSplit'); sp.textContent = '';
  for (const f of ['meta', 'google'] as const) { if (!V.fontesLead.has(f)) continue; const s = el('span'); const i = el('i'); i.style.setProperty('--c', SRC[f].cor); s.append(i, document.createTextNode(`${SRC[f].curto} ${fmt.int(V.TL[f].leads)}`)); sp.append(s); }
  if (V.selLead.length) setSub(P, '#kLeadsSub', deltaEl(V.TL.leads, V.TLP && V.TLP.leads, 'up'));
  else $('#kLeadsSub').textContent = 'nenhuma campanha de lead selecionada';
  P.sparkVals = V.dias.map(d => d.leads.meta + d.leads.google); desenharSparkHero(P, anim);
  countTo(amb, $('#kInv'), V.T.invest, fmt.money, anim, 80);
  if (V.aud.invest > 0 && V.T.invest > 0) $('#kInvSub').textContent = `${fmt.pct0(V.aud.invest / V.T.invest)} em audiência`;
  else setSub(P, '#kInvSub', deltaEl(V.T.invest, V.TP && V.TP.invest, null, true));
  countTo(amb, $('#kCpl'), V.cpl, fmt.money2, anim, 140);
  if (V.selLead.length) setSub(P, '#kCplSub', deltaEl(V.cpl, V.cplPrev, 'down', true));
  else $('#kCplSub').textContent = 'sem lead no filtro';
  countTo(amb, $('#kQual'), V.funil.qual.total, fmt.int, anim, 200);
  $('#kQualSub').textContent = V.TL.leads ? `${fmt.pct(V.funil.qual.total / V.TL.leads)} dos leads` : 'sem leads';
  countTo(amb, $('#kVen'), V.funil.vendas.total, fmt.int, anim, 260);
  $('#kVenSub').textContent = V.TL.leads ? `${fmt.pct(V.funil.vendas.total / V.TL.leads)} dos leads` : 'sem leads';
  countTo(amb, $('#kSeg'), V.aud.seguidores, fmt.int, anim, 320);
  setSub(P, '#kSegSub', deltaEl(V.aud.seguidores, V.aud.seguidoresPrev, 'up', true));
  countTo(amb, $('#kVis'), V.aud.visitas, fmt.int, anim, 380);
  $('#kVisSub').textContent = V.aud.temTrafego ? (V.aud.visitas ? `${fmt.money2(V.aud.investTrafego / V.aud.visitas)} por visita` : 'sem visitas') : 'sem campanha de tráfego';
}

export function renderAudiencia(P: Painel, V: Visao, anim: boolean) {
  const { amb } = P, { $ } = amb;
  const A = V.aud;
  countTo(amb, $('#aSeg'), A.seguidores, fmt.int, anim, 0);
  setSub(P, '#aSegSub', deltaEl(A.seguidores, A.seguidoresPrev, 'up'));
  countTo(amb, $('#aVis'), A.visitas, fmt.int, anim, 60);
  if (A.temTrafego && A.visitas) { const s = el('span'); s.append(document.createTextNode(`${fmt.money2(A.investTrafego / A.visitas)} por visita · `), deltaEl(A.visitas, A.visitasPrev, 'up', true)); setSub(P, '#aVisSub', s); }
  else $('#aVisSub').textContent = A.temTrafego ? 'sem visitas no período' : 'nenhuma campanha de tráfego selecionada';
  countTo(amb, $('#aTp'), A.thruplays, fmt.int, anim, 120);
  if (A.temVideo && A.thruplays) $('#aTpSub').textContent = `${fmt.money2(A.investVideo / A.thruplays)} por ThruPlay · ${fmt.pct(A.thruplays / A.imprVideo)} das impressões`;
  else $('#aTpSub').textContent = A.temVideo ? 'sem ThruPlays no período' : 'nenhuma campanha de vídeo selecionada';
  countTo(amb, $('#aInv'), A.invest, fmt.money, anim, 180);
  $('#aInvSub').textContent = A.impressoes ? `${fmt.comp(A.impressoes)} impressões · CPM ${fmt.money2(A.invest / A.impressoes * 1000)}` : 'nenhuma campanha de audiência selecionada';
  const dias = V.dias;
  P.barSeg.setData(dias, dias.map(d => d.seguidores), '', `Seguidores novos por dia nos últimos ${V.periodo} dias: ${fmt.int(A.seguidores)} no total.`);
  P.barVis.setData(dias, dias.map(d => d.visitas), A.temTrafego ? '' : 'Nenhuma campanha de tráfego', `Visitas ao perfil por dia: ${fmt.int(A.visitas)} no total.`);
  P.barTp.setData(dias, dias.map(d => d.thruplays), A.temVideo ? '' : 'Nenhuma campanha de vídeo', `ThruPlays por dia: ${fmt.int(A.thruplays)} no total.`);
  if (!$('#audTable').hidden) renderTabelaAud(P, V);
}

export function renderTabelaAud(P: Painel, V: Visao) {
  const box = P.amb.$('#audTable'); box.textContent = '';
  const t = el('table', 'dt'), th = el('thead'), hr = el('tr');
  ['Dia', 'Seguidores novos', 'Visitas ao perfil', 'ThruPlays'].forEach(x => hr.append(el('th', '', x)));
  th.append(hr); t.append(th);
  const tb = el('tbody');
  V.dias.slice().reverse().forEach(d => {
    const tr = el('tr');
    [d.hoje ? `${fmt.dm(d.data)} (hoje, parcial)` : fmt.dm(d.data), fmt.int(d.seguidores), V.aud.temTrafego ? fmt.int(d.visitas) : ND, V.aud.temVideo ? fmt.int(d.thruplays) : ND].forEach(x => tr.append(el('td', '', x)));
    tb.append(tr);
  });
  t.append(tb); box.append(t);
}

export function renderRoi(P: Painel, V: Visao, anim: boolean) {
  const { amb } = P, { $ } = amb;
  const R = V.roi;
  countTo(amb, $('#roas'), R.roas, fmt.x, anim, 120);
  countTo(amb, $('#rev'), R.receita, fmt.money, anim, 60);
  const roiEl = $('#roi');
  if (R.roi == null) { roiEl.className = ''; roiEl.textContent = ND; }
  else { roiEl.className = R.roi >= 0 ? 'good' : 'bad'; roiEl.textContent = `${R.roi >= 0 ? '▲' : '▼'} ${fmt.pctS(R.roi)}`; }
  countTo(amb, $('#cac'), R.custoVenda, fmt.money, anim, 120);
  if (V.aud.invest > 0) {
    $('#roasLLbl').textContent = 'ROAS sem audiência';
    countTo(amb, $('#roasL'), V.TL.invest > 0 ? R.receita / V.TL.invest : null, fmt.x, anim, 180);
  } else {
    $('#roasLLbl').textContent = 'Ticket médio';
    countTo(amb, $('#roasL'), R.ticket, fmt.money, anim, 180);
  }
  $('#roiNote').textContent = !V.selLead.length
    ? 'Nenhuma campanha de lead selecionada. Retorno em receita só é medido nas campanhas que geram leads.'
    : V.coorteN
      ? `Receita ganha no Pipedrive com os leads dos últimos ${V.periodo} dias, sobre todo o investimento selecionado. ${fmt.pct0(R.pctAberto as number)} desses leads seguem em aberto, então tende a subir.`
      : 'Sem leads no período para calcular o retorno.';
  P.gauge.setData(R.roas);
}

export function renderEtapas(P: Painel, V: Visao) {
  const { amb } = P, { $, COL } = amb;
  const ul = $('#stl'); ul.textContent = '';
  $('#chipEtapas').textContent = `${fmt.int(V.roi.abertos)} em aberto`;
  const max = Math.max(1, ...ETAPAS_ABERTAS.map(k => V.pipe[k].n));
  ETAPAS_ABERTAS.forEach((k, i) => {
    const s = V.pipe[k], li = el('li'); li.dataset.k = k; li.style.setProperty('--c', COL.st[i]);
    const nm = el('span', 'sn', ETAPA_NOME[k]); const bar = el('span', 'sb'); const fill = el('i'); bar.append(fill); nm.append(bar);
    li.append(el('i', 'sd'), nm, el('span', 'sc', fmt.int(s.n)), el('span', 'sv', fmt.moneyK(s.valor)));
    li.title = `${ETAPA_NOME[k]}: ${fmt.int(s.n)} negócios, ${fmt.money(s.valor)}. Parados há 7 dias ou mais: ${fmt.int(s.parados)}.`;
    li.addEventListener('pointerenter', () => P.orbita.highlight(k));
    li.addEventListener('pointerleave', () => P.orbita.highlight(null));
    ul.append(li);
    amb.raf(() => amb.raf(() => { fill.style.width = (s.n / max * 100).toFixed(1) + '%'; }));
  });
  const f = $('#stf'); f.textContent = '';
  const item = (pre: string, strong: string, pos: string, cls?: string) => { const s = el('span', cls || ''); s.append(pre, el('b', '', strong), pos || ''); f.append(s); };
  item('Em aberto ', fmt.money(V.roi.valorAberto), '');
  item('Perdidos ', fmt.int(V.pipe.perdido.n), V.coorteN ? ` · ${fmt.pct0(V.pipe.perdido.n / V.coorteN)} dos leads` : '');
  item('Parados 7+ dias ', fmt.int(V.roi.parados), '', V.roi.parados ? 'bad' : '');
}

export function renderObjetivos(P: Painel, V: Visao) {
  const box = P.amb.$('#objWrap'); box.textContent = '';
  if (!V.porObjetivo.length) { box.hidden = true; return; }
  box.hidden = false;
  const t = el('table', 'obj'), th = el('thead'), hr = el('tr');
  ['Objetivo', 'Campanhas', 'Investimento', 'Resultado', 'Custo por resultado'].forEach((h, i) => hr.append(el('th', i === 1 ? 'n' : '', h)));
  th.append(hr); t.append(th);
  const tb = el('tbody');
  for (const o of V.porObjetivo) {
    const O = OBJ[o.o], tr = el('tr');
    tr.append(el('td', '', O.nome), el('td', 'n', fmt.int(o.n)), el('td', '', fmt.money(o.invest)));
    const r = el('td'); r.append(document.createTextNode(fmt.int(o.res)), el('span', 'u', O.res)); tr.append(r);
    const c = el('td'); c.append(document.createTextNode(o.custo == null ? ND : fmt.money2(o.custo)), el('span', 'u', `por ${O.un}`)); tr.append(c);
    tb.append(tr);
  }
  t.append(tb); box.append(t);
}

export function ajustarColunasCamps(P: Painel) {
  const box = P.amb.$('#camps'), n = box.querySelectorAll('.camp').length;
  if (!n) { box.style.gridTemplateColumns = ''; return; }
  let cols = Math.max(1, Math.min(n, Math.floor((box.clientWidth + 10) / 250)));
  cols = Math.ceil(n / Math.ceil(n / cols));
  box.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
}
export function renderCamps(P: Painel, V: Visao, anim: boolean) {
  const { amb } = P, { $, $$, SRC } = amb;
  const box = $('#camps'); box.textContent = '';
  $('#chipCamp').textContent = `${V.sel.length} de ${V.visiveis.length} selecionadas`;
  if (!V.sel.length) { box.append(vazio('Nenhuma campanha selecionada. Escolha no filtro Campanhas, no topo.')); ajustarColunasCamps(P); return; }
  V.cards.forEach((cd, i) => {
    const c = cd.c, e = el('div', 'camp fx'), s = cd.s;
    e.style.setProperty('--c', SRC[c.fonte].cor);
    e.innerHTML = '<i class="glare"></i><div class="c-top"><span class="c-src"><i></i><span></span></span><span class="pill-s"><i></i></span></div><div class="c-title"></div><div class="c-type"></div><div class="c-mid"><div class="c-big"><b></b><span></span></div><canvas class="c-spark" aria-hidden="true"></canvas></div><div class="c-grid"></div><div class="pace"><div class="pace-h"><span></span><b></b></div><div class="pace-bar"><i></i></div></div>';
    const q = <T extends Element = HTMLElement>(sel: string) => e.querySelector<T>(sel)!;
    q('.c-src span').textContent = `${SRC[c.fonte].nome} · ${OBJ[c.objetivo].rotulo}`;
    const pill = q('.pill-s'); pill.classList.add(c.status === 'ativa' ? 'on' : 'off'); pill.append(c.status === 'ativa' ? 'Ativa' : 'Pausada');
    q('.c-title').textContent = c.nome;
    q('.c-type').textContent = c.tipo;
    let big: number, bigLbl: string, cells: [string, string][];
    const ctr = s.impressoes ? fmt.pct(s.cliques / s.impressoes) : ND, cpm = s.impressoes ? fmt.money2(s.invest / s.impressoes * 1000) : ND;
    if (c.objetivo === 'leads') {
      big = s.leads; bigLbl = 'leads';
      cells = [['Investimento', fmt.money(s.invest)], ['CPL', s.leads ? fmt.money2(s.invest / s.leads) : ND], ['CTR', ctr], ['Qualificados', s.leads ? `${fmt.int(cd.q)} · ${fmt.pct0(cd.q / s.leads)}` : '0']];
    } else if (c.objetivo === 'trafego') {
      big = s.visitas; bigLbl = 'visitas ao perfil';
      cells = [['Investimento', fmt.money(s.invest)], ['Custo por visita', s.visitas ? fmt.money2(s.invest / s.visitas) : ND], ['CTR', ctr], ['CPM', cpm]];
    } else {
      big = s.thruplays; bigLbl = 'ThruPlays';
      cells = [['Investimento', fmt.money(s.invest)], ['Custo por ThruPlay', s.thruplays ? fmt.money2(s.invest / s.thruplays) : ND], ['Taxa de ThruPlay', s.impressoes ? fmt.pct(s.thruplays / s.impressoes) : ND], ['CPM', cpm]];
    }
    q('.c-big span').textContent = bigLbl;
    countTo(amb, q('.c-big b'), big, fmt.int, anim, 120 + i * 60);
    const grid = q('.c-grid');
    for (const [k, v] of cells) { const cell = el('div', 'cell'); cell.append(el('div', 'k', k), el('div', 'v', v)); grid.append(cell); }
    const lbl = q('.pace-h span'), val = q('.pace-h b'), bar = q('.pace-bar i');
    const ritmo = cd.orcPeriodo > 0 ? s.invest / cd.orcPeriodo : 0;
    if (c.status === 'pausada') { lbl.textContent = c.pausaEm ? `Pausada em ${fmt.dm(c.pausaEm)}` : 'Pausada'; val.textContent = `${fmt.money(s.invest)} no período`; }
    else { lbl.textContent = 'Ritmo do orçamento'; val.textContent = `${fmt.pct0(ritmo)} de ${fmt.money(cd.orcPeriodo)}`; }
    box.append(e);
    amb.raf(() => amb.raf(() => { bar.style.width = clamp(ritmo * 100, 0, 100) + '%'; }));
    tilt(amb, e); spot(amb, e);
  });
  ajustarColunasCamps(P);
  $$('#camps .camp').forEach((e, i) => sparkline(amb, e.querySelector<HTMLCanvasElement>('.c-spark')!, V.cards[i].serie, SRC[V.cards[i].c.fonte].cor, anim));
}

export function renderFeed(P: Painel, V: Visao, anim: boolean) {
  const { amb } = P, { $, SRC } = amb;
  const ol = $('#feed'); ol.textContent = '';
  $('#chipEv').textContent = `${fmt.int(V.eventos.length)} no período`;
  const evs = V.eventos.slice(-12).reverse();
  if (!evs.length) { const li = el('li'); li.append(vazio('Sem eventos para as campanhas selecionadas.')); ol.append(li); return; }
  evs.forEach((ev, i) => {
    const li = el('li', 'ev' + (ev.cls ? ' ' + ev.cls : ''));
    if (anim && !amb.REDUCED) { li.classList.add('in'); li.style.animationDelay = `${i * 45}ms`; }
    const dot = el('i', 'ed'); dot.style.setProperty('--c', SRC[ev.fonte].cor);
    const body = el('div'); const top = el('div', 'et');
    const k = el('span', 'ek', (ev.cls === 'win' ? '✓ ' : ev.cls === 'lost' ? '✕ ' : '') + ev.kind);
    const dt = new Date(ev.t); const tm = el('time', '', `${fmt.dm(dt)} · ${fmt.hm(dt)}`); tm.dateTime = dt.toISOString();
    top.append(k, tm); body.append(top, el('p', 'em', ev.msg));
    li.append(dot, body); ol.append(li);
  });
}

export function renderTabela(P: Painel, V: Visao) {
  const box = P.amb.$('#dTable'); box.textContent = '';
  const t = el('table', 'dt'), th = el('thead'), hr = el('tr');
  ['Dia', 'Leads Meta', 'Leads Google', 'Investimento em lead', 'CPL 7d Meta', 'CPL 7d Google'].forEach(x => hr.append(el('th', '', x)));
  th.append(hr); t.append(th);
  const tb = el('tbody');
  V.dias.slice().reverse().forEach(d => {
    const tr = el('tr');
    [d.hoje ? `${fmt.dm(d.data)} (hoje, parcial)` : fmt.dm(d.data), fmt.int(d.leads.meta), fmt.int(d.leads.google), fmt.money(d.investLead), d.cpl7.meta == null ? ND : fmt.money2(d.cpl7.meta), d.cpl7.google == null ? ND : fmt.money2(d.cpl7.google)].forEach(x => tr.append(el('td', '', x)));
    tb.append(tr);
  });
  t.append(tb); box.append(t);
}
