import { fmt } from '@/lib/formato';
import type { DiaVisao } from '@/lib/metricas/computar';
import { clamp, ease } from '@/lib/util';
import { el, type Ambiente, type Componente } from '../ambiente';
import { larguraTicks, msgVazio, niceMax, prepCanvas, rgba, topoArredondado } from '../desenho';

/* ================= barras simples (audiência) ================= */

export interface Barras extends Componente {
  setData(dias: DiaVisao[], vals: number[], vazioMsg: string, ariaTexto: string): void;
  replay(): void;
}

export function criarBarras(amb: Ambiente, wrapSel: string, cvSel: string, tipSel: string, cor: string, rotulo: string): Barras {
  const { $, COL, MONO, REDUCED, signal } = amb;
  const wrap = $(wrapSel), cv = $<HTMLCanvasElement>(cvSel), tip = $(tipSel);
  const st = {
    ctx: null as CanvasRenderingContext2D | null, W: 0, H: 0, dias: null as DiaVisao[] | null, vals: null as number[] | null, vazio: '', t0: 0, hover: -1,
    lay: null as { padL: number; slot: number; n: number; xc: (i: number) => number } | null, py: null as number | null, dirty: true
  };
  function resize() {
    const r = wrap.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    st.W = Math.round(r.width); st.H = Math.round(r.height); st.ctx = prepCanvas(cv, st.W, st.H); st.dirty = true;
  }
  function setData(dias: DiaVisao[], vals: number[], vazioMsg: string, ariaTexto: string) {
    st.dias = dias; st.vals = vals; st.vazio = vazioMsg || ''; st.t0 = performance.now(); st.hover = -1; tip.hidden = true; st.dirty = true;
    cv.setAttribute('aria-label', ariaTexto || rotulo);
  }
  function draw(now: number) {
    const { ctx, W, H, vals, dias } = st;
    if (!ctx || !vals || !dias) return;
    if (!st.dirty && now - st.t0 > 1300) return;
    ctx.clearRect(0, 0, W, H);
    if (st.vazio) { msgVazio(amb, ctx, W, H, st.vazio); st.lay = null; if (now - st.t0 > 1300) st.dirty = false; return; }
    const sc = niceMax(Math.max(0, ...vals.map(v => v || 0)), 3, true), ft = sc.max >= 10000 ? fmt.comp : fmt.int;
    ctx.font = `500 10px ${MONO}`;
    const n = vals.length, padL = Math.ceil(larguraTicks(ctx, sc, ft)) + 10, padR = 4, padT = 6, axisH = 20, h1 = H - padT - axisH, base = padT + h1, iw = W - padL - padR, slot = iw / n;
    const xc = (i: number) => padL + slot * (i + .5);
    st.lay = { padL, slot, n, xc };
    ctx.textBaseline = 'middle'; ctx.lineWidth = 1;
    for (let v = 0; v <= sc.max + 1e-6; v += sc.step) {
      const y = Math.round(base - v / sc.max * h1) + .5;
      ctx.strokeStyle = v === 0 ? COL.axis : COL.hair; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      ctx.fillStyle = COL.ink3; ctx.textAlign = 'right'; ctx.fillText(ft(v), padL - 6, y);
    }
    const el0 = now - st.t0, bw = clamp(slot * .6, 1.5, 16), r = Math.min(3, bw / 2), stg = Math.min(18, 420 / n);
    for (let i = 0; i < n; i++) {
      const k = REDUCED ? 1 : ease.back(clamp((el0 - i * stg) / 550, 0, 1));
      const v = Math.max(0, (vals[i] || 0) * k), hh = v / sc.max * h1;
      if (hh < .4) continue;
      topoArredondado(ctx, xc(i) - bw / 2, base - hh, bw, hh, r);
      const gr = ctx.createLinearGradient(0, base - hh, 0, base); gr.addColorStop(0, cor); gr.addColorStop(1, rgba(cor, .4));
      ctx.globalAlpha = dias[i].hoje ? .55 : (st.hover >= 0 && st.hover !== i ? .55 : 1); ctx.fillStyle = gr; ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.textBaseline = 'top'; ctx.textAlign = 'center'; ctx.fillStyle = COL.ink3; ctx.font = `500 10px ${MONO}`;
    [0, n - 1].forEach(i => ctx.fillText(dias[i].hoje ? 'hoje' : fmt.dm(dias[i].data), clamp(xc(i), padL + 14, W - 16), base + 6));
    if (now - st.t0 > 1300) st.dirty = false;
  }
  function mostrar(i: number) {
    const L = st.lay; if (!L || !st.vals || !st.dias || st.vazio) return;
    st.hover = i; st.dirty = true;
    const d = st.dias[i]; tip.textContent = '';
    tip.append(el('div', 'td', d.hoje ? `Hoje · ${fmt.dm(d.data)} · parcial` : `${fmt.wd(d.data)} · ${fmt.dm(d.data)}`));
    const r = el('div', 'tr'); const k = el('i', 'key'); k.style.setProperty('--c', cor); r.append(k, el('b', '', fmt.int(st.vals[i] || 0)), el('span', '', rotulo)); tip.append(r);
    tip.hidden = false;
    const tw = tip.offsetWidth, th = tip.offsetHeight, x = L.xc(i);
    let left = x + 12; if (left + tw > st.W - 2) left = x - tw - 12;
    left = clamp(left, 2, Math.max(2, st.W - tw - 2));
    const top = clamp(st.py == null ? 4 : st.py - th / 2, 2, Math.max(2, st.H - th - 2));
    tip.style.transform = `translate(${Math.round(left)}px,${Math.round(top)}px)`;
    if (REDUCED) draw(performance.now());
  }
  function esconder() { if (st.hover < 0) return; st.hover = -1; st.dirty = true; tip.hidden = true; if (REDUCED) draw(performance.now()); }
  function idx(clientX: number) { const L = st.lay; if (!L) return -1; const r = wrap.getBoundingClientRect(); return clamp(Math.floor((clientX - r.left - L.padL) / L.slot), 0, L.n - 1); }
  wrap.addEventListener('pointermove', e => { st.py = e.clientY - wrap.getBoundingClientRect().top; mostrar(idx(e.clientX)); }, { signal });
  wrap.addEventListener('pointerdown', e => { st.py = e.clientY - wrap.getBoundingClientRect().top; mostrar(idx(e.clientX)); }, { signal });
  wrap.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') esconder(); }, { signal });
  wrap.addEventListener('blur', esconder, { signal });
  document.addEventListener('pointerdown', e => { if (st.hover >= 0 && !wrap.contains(e.target as Node)) esconder(); }, { signal });
  wrap.addEventListener('keydown', e => {
    if (!st.vals) return;
    const n = st.vals.length;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); st.py = null; mostrar(st.hover < 0 ? n - 1 : clamp(st.hover + (e.key === 'ArrowRight' ? 1 : -1), 0, n - 1)); }
    else if (e.key === 'Escape') esconder();
  }, { signal });
  function replay() { st.t0 = performance.now(); st.dirty = true; }
  return { resize, setData, draw, replay, el: wrap, visible: true };
}
