import { fmt } from '@/lib/formato';
import type { Visao } from '@/lib/metricas/computar';
import type { Fonte } from '@/lib/tipos';
import { clamp, ease, lerp } from '@/lib/util';
import { el, type Ambiente, type Componente } from '../ambiente';
import { larguraTicks, msgVazio, niceMax, prepCanvas, rgba, topoArredondado, type Escala } from '../desenho';

/* ================= leads por dia (empilhado por fonte) ================= */

interface Dia { data: Date; hoje: boolean; meta: number; google: number; invest: number }
interface Par { meta: number; google: number }

export interface Diario extends Componente {
  setData(V: Visao, intro?: boolean): void;
  replay(): void;
}

export function criarDiario(amb: Ambiente): Diario {
  const { $, COL, SANS, MONO, REDUCED, signal } = amb;
  const wrap = $('#dWrap'), cv = $<HTMLCanvasElement>('#daily'), tip = $('#dTip');
  const st = {
    ctx: null as CanvasRenderingContext2D | null, W: 0, H: 0,
    cur: null as { dias: Dia[]; fontes: Set<Fonte>; vazio: boolean } | null,
    from: null as Par[] | null, shown: null as Par[] | null, t0: 0, mode: 'intro' as 'intro' | 'morph', hover: -1,
    lay: null as { padL: number; slot: number; n: number; xc: (i: number) => number } | null,
    sc: null as Escala | null, scT: null as Escala | null, scF: null as Escala | null, py: null as number | null, dirty: true
  };
  function resize() {
    const r = wrap.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    st.W = Math.round(r.width); st.H = Math.round(r.height); st.ctx = prepCanvas(cv, st.W, st.H); st.dirty = true;
  }
  function setData(V: Visao, intro?: boolean) {
    const dias = V.dias.map(d => ({ data: d.data, hoje: d.hoje, meta: d.leads.meta, google: d.leads.google, invest: d.investLead }));
    const same = !intro && st.cur && st.cur.dias.length === dias.length && st.shown && st.shown.length === dias.length;
    st.from = same ? st.shown!.map(v => Object.assign({}, v)) : null;
    st.scF = same ? st.sc : null; st.mode = same ? 'morph' : 'intro';
    st.scT = niceMax(Math.max(0, ...dias.map(d => d.meta + d.google)), 4, true);
    st.cur = { dias, fontes: V.fontesLead, vazio: !V.selLead.length };
    st.t0 = performance.now(); st.hover = -1; tip.hidden = true; st.dirty = true;
    cv.setAttribute('aria-label', V.selLead.length ? `Leads por dia nos últimos ${V.periodo} dias: ${fmt.int(V.TL.leads)} no total, ${fmt.int(V.TL.meta.leads)} do Meta Ads e ${fmt.int(V.TL.google.leads)} do Google Ads.` : 'Nenhuma campanha de lead selecionada.');
  }
  function draw(now: number) {
    const { ctx, W, H, cur } = st;
    if (!ctx || !cur) return;
    if (!st.dirty && now - st.t0 > 1500) return;
    ctx.clearRect(0, 0, W, H);
    if (cur.vazio) { msgVazio(amb, ctx, W, H, 'Nenhuma campanha de lead selecionada'); st.lay = null; if (now - st.t0 > 1500) st.dirty = false; return; }
    const scT = st.scT!;
    const n = cur.dias.length, small = W < 480;
    ctx.font = `500 10px ${MONO}`;
    const padL = Math.ceil(larguraTicks(ctx, scT, fmt.int)) + 12, padR = 6, padT = 8, axisH = 22;
    const h1 = H - padT - axisH, base = padT + h1, iw = W - padL - padR, slot = iw / n;
    const xc = (i: number) => padL + slot * (i + .5);
    st.lay = { padL, slot, n, xc };
    const el0 = now - st.t0, eM = REDUCED ? 1 : ease.out(clamp(el0 / 700, 0, 1));
    const sc = st.mode === 'morph' && st.scF ? { max: lerp(st.scF.max, scT.max, eM), step: scT.step } : scT;
    st.sc = sc;
    const shown = cur.dias.map((d, i) => st.mode === 'morph' && st.from ? { meta: lerp(st.from[i].meta, d.meta, eM), google: lerp(st.from[i].google, d.google, eM) } : { meta: d.meta, google: d.google });
    st.shown = shown;
    ctx.font = `500 10px ${MONO}`; ctx.textBaseline = 'middle'; ctx.lineWidth = 1;
    for (let v = 0; v <= sc.max + 1e-6; v += sc.step) {
      const y = Math.round(base - v / sc.max * h1) + .5;
      ctx.strokeStyle = v === 0 ? COL.axis : COL.hair; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      ctx.fillStyle = COL.ink3; ctx.textAlign = 'right'; ctx.fillText(fmt.int(v), padL - 7, y);
    }
    const bw = clamp(slot * .6, 2, 22), gap = bw >= 5 ? 2 : 1, r = Math.min(4, bw / 2), stg = Math.min(22, 520 / n);
    for (let i = 0; i < n; i++) {
      const k = st.mode === 'intro' && !REDUCED ? ease.back(clamp((el0 - i * stg) / 600, 0, 1)) : 1;
      const m = Math.max(0, shown[i].meta * k), g = Math.max(0, shown[i].google * k);
      const x = xc(i) - bw / 2, hm = m / sc.max * h1, hg = g / sc.max * h1, hl = st.hover === i, part = cur.dias[i].hoje;
      const seg = (y: number, hh: number, color: string, rr: number) => {
        topoArredondado(ctx, x, y, bw, hh, rr);
        const gr = ctx.createLinearGradient(0, y, 0, y + hh); gr.addColorStop(0, color); gr.addColorStop(1, rgba(color, .45));
        ctx.globalAlpha = part ? .55 : (st.hover >= 0 && !hl ? .55 : 1); ctx.fillStyle = gr;
        if (hl) { ctx.shadowColor = rgba(color, .8); ctx.shadowBlur = 14; }
        ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      };
      if (hm > .4) seg(base - hm, hm, COL.meta, hg > .4 ? 0 : r);
      if (hg > .4) seg(base - hm - (hm > .4 ? gap : 0) - hg, hg, COL.google, r);
    }
    if (st.hover >= 0 && st.hover < n) { const x = Math.round(xc(st.hover)) + .5; ctx.strokeStyle = rgba(COL.accent, .35); ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, base); ctx.stroke(); }
    ctx.textBaseline = 'top'; ctx.textAlign = 'center'; ctx.fillStyle = COL.ink3; ctx.font = `500 10px ${MONO}`;
    const every = Math.max(1, Math.ceil((small ? 46 : 52) / slot));
    for (let i = n - 1; i >= 0; i -= every) { const d = cur.dias[i]; ctx.fillText(d.hoje ? 'hoje' : fmt.dm(d.data), clamp(xc(i), padL + 14, W - 16), base + 7); }
    if (!cur.dias.some(d => d.meta + d.google > 0)) { ctx.fillStyle = COL.ink3; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `500 12px ${SANS}`; ctx.fillText('Sem leads no período', padL + iw / 2, padT + h1 / 2); }
    if (now - st.t0 > 1500) st.dirty = false;
  }
  function preencher(i: number) {
    const cur = st.cur!, d = cur.dias[i];
    tip.textContent = '';
    tip.append(el('div', 'td', d.hoje ? `Hoje · ${fmt.dm(d.data)} · parcial` : `${fmt.wd(d.data)} · ${fmt.dm(d.data)}`));
    const row = (color: string | null, val: string, label: string) => { const r = el('div', 'tr'); const k = el('i', 'key'); if (color) k.style.setProperty('--c', color); else k.style.visibility = 'hidden'; r.append(k, el('b', '', val), el('span', '', label)); tip.append(r); };
    if (cur.fontes.has('meta')) row(COL.meta, fmt.int(d.meta), 'Meta Ads');
    if (cur.fontes.has('google')) row(COL.google, fmt.int(d.google), 'Google Ads');
    tip.append(el('div', 'sep'));
    row(null, fmt.int(d.meta + d.google), 'leads no dia');
    row(null, fmt.money(d.invest), 'investimento em lead');
  }
  function mostrar(i: number) {
    const L = st.lay; if (!L || !st.cur || st.cur.vazio) return;
    st.hover = i; st.dirty = true; preencher(i); tip.hidden = false;
    const tw = tip.offsetWidth, th = tip.offsetHeight, x = L.xc(i);
    let left = x + 14; if (left + tw > st.W - 2) left = x - tw - 14;
    left = clamp(left, 2, Math.max(2, st.W - tw - 2));
    const top = clamp(st.py == null ? 6 : st.py - th / 2, 2, Math.max(2, st.H - th - 2));
    tip.style.transform = `translate(${Math.round(left)}px,${Math.round(top)}px)`;
    if (REDUCED) draw(performance.now());
  }
  function esconder() { if (st.hover < 0) return; st.hover = -1; st.dirty = true; tip.hidden = true; if (REDUCED) draw(performance.now()); }
  function idx(clientX: number) { const L = st.lay; if (!L) return -1; const r = wrap.getBoundingClientRect(); return clamp(Math.floor((clientX - r.left - L.padL) / L.slot), 0, L.n - 1); }
  wrap.addEventListener('pointermove', e => { if (!st.cur) return; st.py = e.clientY - wrap.getBoundingClientRect().top; mostrar(idx(e.clientX)); }, { signal });
  wrap.addEventListener('pointerdown', e => { if (!st.cur) return; st.py = e.clientY - wrap.getBoundingClientRect().top; mostrar(idx(e.clientX)); }, { signal });
  wrap.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') esconder(); }, { signal });
  wrap.addEventListener('blur', esconder, { signal });
  document.addEventListener('pointerdown', e => { if (st.hover >= 0 && !wrap.contains(e.target as Node)) esconder(); }, { signal });
  wrap.addEventListener('keydown', e => {
    if (!st.cur) return;
    const n = st.cur.dias.length;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); st.py = null; mostrar(st.hover < 0 ? n - 1 : clamp(st.hover + (e.key === 'ArrowRight' ? 1 : -1), 0, n - 1)); }
    else if (e.key === 'Escape') esconder();
  }, { signal });
  function replay() { st.mode = 'intro'; st.from = null; st.scF = null; st.t0 = performance.now(); st.dirty = true; }
  return { resize, setData, draw, replay, el: wrap, visible: true };
}
