import { fmt, ND } from '@/lib/formato';
import type { Visao } from '@/lib/metricas/computar';
import type { Fonte } from '@/lib/tipos';
import { clamp, ease, TAU } from '@/lib/util';
import { el, type Ambiente, type Componente } from '../ambiente';
import { larguraTicks, msgVazio, niceMax, prepCanvas, rgba, type Escala } from '../desenho';

/* ================= CPL por fonte ================= */

interface Dia { data: Date; hoje: boolean; m: number | null; g: number | null }

export interface Cpl extends Componente {
  setData(V: Visao): void;
  replay(): void;
}

export function criarCpl(amb: Ambiente): Cpl {
  const { $, COL, MONO, SRC, REDUCED, signal } = amb;
  const wrap = $('#cplWrap'), cv = $<HTMLCanvasElement>('#cpl'), tip = $('#cplTip');
  const st = {
    ctx: null as CanvasRenderingContext2D | null, W: 0, H: 0,
    cur: null as { dias: Dia[]; fontes: Set<Fonte>; sc: Escala } | null, t0: 0, hover: -1,
    lay: null as { padL: number; iw: number; n: number; xc: (i: number) => number } | null, dirty: true
  };
  const chave = (f: Fonte) => (f === 'meta' ? 'm' : 'g');
  function resize() {
    const r = wrap.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    st.W = Math.round(r.width); st.H = Math.round(r.height); st.ctx = prepCanvas(cv, st.W, st.H); st.dirty = true;
  }
  function setData(V: Visao) {
    const dias = V.dias.map(d => ({ data: d.data, hoje: d.hoje, m: d.cpl7.meta, g: d.cpl7.google }));
    st.cur = { dias, fontes: V.fontesLead, sc: niceMax(Math.max(0, ...dias.map(d => Math.max(d.m || 0, d.g || 0))), 2, false) };
    st.t0 = performance.now(); st.hover = -1; tip.hidden = true; st.dirty = true;
    const ult = dias[dias.length - 1];
    cv.setAttribute('aria-label', `CPL médio de 7 dias por fonte, só campanhas de lead. Hoje: Meta Ads ${ult.m == null ? ND : fmt.money2(ult.m)}, Google Ads ${ult.g == null ? ND : fmt.money2(ult.g)}.`);
  }
  function draw(now: number) {
    const { ctx, W, H, cur } = st;
    if (!ctx || !cur) return;
    if (!st.dirty && now - st.t0 > 1300) return;
    ctx.clearRect(0, 0, W, H);
    if (!cur.fontes.size) { msgVazio(amb, ctx, W, H, 'Nenhuma campanha de lead selecionada'); st.lay = null; if (now - st.t0 > 1300) st.dirty = false; return; }
    const sc = cur.sc;
    ctx.font = `500 10px ${MONO}`;
    const n = cur.dias.length, padL = Math.ceil(larguraTicks(ctx, sc, fmt.money)) + 12, padR = 52, padT = 10, axisH = 18, h = H - padT - axisH, base = padT + h, iw = W - padL - padR;
    const xc = (i: number) => padL + (n > 1 ? iw * i / (n - 1) : iw / 2);
    st.lay = { padL, iw, n, xc };
    ctx.textBaseline = 'middle'; ctx.lineWidth = 1;
    for (let v = 0; v <= sc.max + 1e-6; v += sc.step) {
      const y = Math.round(base - v / sc.max * h) + .5;
      ctx.strokeStyle = v === 0 ? COL.axis : COL.hair; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      ctx.fillStyle = COL.ink3; ctx.textAlign = 'right'; ctx.fillText(fmt.money(v), padL - 8, y);
    }
    const rev = REDUCED ? 1 : ease.inOut(clamp((now - st.t0) / 1100, 0, 1)), revX = padL + iw * rev;
    const Y = (v: number) => base - clamp(v / sc.max, 0, 1.05) * h;
    ctx.save(); ctx.beginPath(); ctx.rect(padL - 6, padT - 6, revX - padL + 12, h + 12); ctx.clip();
    const ends: { x: number; y: number; v: number; color: string }[] = [];
    for (const f of ['meta', 'google'] as const) {
      if (!cur.fontes.has(f)) continue;
      const key = chave(f), color = SRC[f].cor;
      ctx.beginPath(); let on = false, last = -1;
      for (let i = 0; i < n; i++) { const v = cur.dias[i][key]; if (v == null) { on = false; continue; } const x = xc(i), y = Y(v); if (!on) { ctx.moveTo(x, y); on = true; } else ctx.lineTo(x, y); last = i; }
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.shadowColor = rgba(color, .7); ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;
      if (last >= 0) ends.push({ x: xc(last), y: Y(cur.dias[last][key] as number), v: cur.dias[last][key] as number, color });
    }
    ctx.restore();
    if (rev >= 1) {
      for (const e of ends) { ctx.beginPath(); ctx.arc(e.x, e.y, 6, 0, TAU); ctx.fillStyle = COL.surface; ctx.fill(); ctx.beginPath(); ctx.arc(e.x, e.y, 4, 0, TAU); ctx.fillStyle = e.color; ctx.fill(); }
      if (!(ends.length === 2 && Math.abs(ends[0].y - ends[1].y) < 14)) { ctx.textAlign = 'left'; ctx.fillStyle = COL.ink2; ctx.font = `500 10.5px ${MONO}`; for (const e of ends) ctx.fillText(fmt.money(e.v), e.x + 10, e.y); }
    }
    if (st.hover >= 0) {
      const x = Math.round(xc(st.hover)) + .5; ctx.strokeStyle = rgba(COL.accent, .35); ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, base); ctx.stroke();
      for (const f of ['meta', 'google'] as const) { if (!cur.fontes.has(f)) continue; const v = cur.dias[st.hover][chave(f)]; if (v == null) continue; ctx.beginPath(); ctx.arc(x, Y(v), 6, 0, TAU); ctx.fillStyle = COL.surface; ctx.fill(); ctx.beginPath(); ctx.arc(x, Y(v), 4, 0, TAU); ctx.fillStyle = SRC[f].cor; ctx.fill(); }
    }
    ctx.textBaseline = 'top'; ctx.textAlign = 'center'; ctx.fillStyle = COL.ink3; ctx.font = `500 10px ${MONO}`;
    [0, Math.floor((n - 1) / 2), n - 1].forEach(i => { const d = cur.dias[i]; ctx.fillText(d.hoje ? 'hoje' : fmt.dm(d.data), clamp(xc(i), padL + 14, W - padR), base + 5); });
    if (now - st.t0 > 1300) st.dirty = false;
  }
  function mostrar(i: number, py: number | null) {
    const L = st.lay; if (!L || !st.cur || !st.cur.fontes.size) return;
    st.hover = i; st.dirty = true; const d = st.cur.dias[i];
    tip.textContent = ''; tip.append(el('div', 'td', d.hoje ? `Hoje · ${fmt.dm(d.data)}` : `${fmt.wd(d.data)} · ${fmt.dm(d.data)}`));
    for (const f of ['meta', 'google'] as const) { if (!st.cur.fontes.has(f)) continue; const v = d[chave(f)]; const r = el('div', 'tr'); const k = el('i', 'key'); k.style.setProperty('--c', SRC[f].cor); r.append(k, el('b', '', v == null ? ND : fmt.money2(v)), el('span', '', SRC[f].nome)); tip.append(r); }
    tip.hidden = false;
    const tw = tip.offsetWidth, th = tip.offsetHeight, x = L.xc(i);
    let left = x + 12; if (left + tw > st.W - 2) left = x - tw - 12;
    left = clamp(left, 2, Math.max(2, st.W - tw - 2));
    const top = clamp(py == null ? 4 : py - th / 2, 2, Math.max(2, st.H - th - 2));
    tip.style.transform = `translate(${Math.round(left)}px,${Math.round(top)}px)`;
    if (REDUCED) draw(performance.now());
  }
  function esconder() { if (st.hover < 0) return; st.hover = -1; st.dirty = true; tip.hidden = true; if (REDUCED) draw(performance.now()); }
  function idx(clientX: number) { const L = st.lay; if (!L) return -1; const r = wrap.getBoundingClientRect(); return clamp(Math.round((clientX - r.left - L.padL) / (L.iw / Math.max(1, L.n - 1))), 0, L.n - 1); }
  wrap.addEventListener('pointermove', e => mostrar(idx(e.clientX), e.clientY - wrap.getBoundingClientRect().top), { signal });
  wrap.addEventListener('pointerdown', e => mostrar(idx(e.clientX), e.clientY - wrap.getBoundingClientRect().top), { signal });
  wrap.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') esconder(); }, { signal });
  wrap.addEventListener('blur', esconder, { signal });
  document.addEventListener('pointerdown', e => { if (st.hover >= 0 && !wrap.contains(e.target as Node)) esconder(); }, { signal });
  wrap.addEventListener('keydown', e => {
    if (!st.cur) return;
    const n = st.cur.dias.length;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); mostrar(st.hover < 0 ? n - 1 : clamp(st.hover + (e.key === 'ArrowRight' ? 1 : -1), 0, n - 1), null); }
    else if (e.key === 'Escape') esconder();
  }, { signal });
  function replay() { st.t0 = performance.now(); st.dirty = true; }
  return { resize, setData, draw, replay, el: wrap, visible: true };
}
