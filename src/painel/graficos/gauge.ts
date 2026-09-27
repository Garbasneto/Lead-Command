import { fmt } from '@/lib/formato';
import { clamp, ease, lerp, TAU } from '@/lib/util';
import type { Ambiente, Componente } from '../ambiente';
import { prepCanvas, rgba } from '../desenho';

/* ================= medidor de retorno ================= */

export interface Gauge extends Componente {
  setData(roas: number | null): void;
  replay(): void;
}

export function criarGauge(amb: Ambiente): Gauge {
  const { $, COL, MONO, REDUCED } = amb;
  const wrap = $('#gaugeWrap'), cv = $<HTMLCanvasElement>('#gauge');
  const st = { ctx: null as CanvasRenderingContext2D | null, W: 0, H: 0, v: null as number | null, from: 0, shown: 0, max: 3, maxF: 3, t0: 0 };
  function resize() {
    const r = wrap.getBoundingClientRect();
    if (r.width < 10) return;
    st.W = Math.round(r.width); st.H = Math.round(r.height); st.ctx = prepCanvas(cv, st.W, st.H);
  }
  function setData(roas: number | null) { st.from = st.shown; st.maxF = st.max; st.v = roas; st.max = Math.max(3, Math.ceil((roas || 0) + .25)); st.t0 = performance.now(); }
  function draw(now: number) {
    const { ctx, W, H } = st;
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    const e = REDUCED ? 1 : ease.out(clamp((now - st.t0) / 1300, 0, 1));
    const val = lerp(st.from, st.v == null ? 0 : st.v, e); st.shown = val;
    const max = lerp(st.maxF, st.max, e);
    const cx = W / 2, cy = 78, R = Math.min(W * .3, 64), lw = 7;
    const a0 = Math.PI * 5 / 6, a1 = Math.PI * 13 / 6, span = a1 - a0;
    const col = st.v == null ? COL.ink3 : st.v >= 1 ? COL.good : COL.bad;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 48; i++) {
      const a = a0 + span * i / 48, big = i % 8 === 0, r1 = R + lw / 2 + 5, r2 = r1 + (big ? 6 : 3);
      ctx.strokeStyle = rgba('#a0f0e6', big ? .35 : .15);
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); ctx.stroke();
    }
    ctx.lineCap = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = rgba(col, .15);
    ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.stroke();
    const f = clamp(val / max, 0, 1);
    if (f > .002) {
      ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(cx, cy, R, a0, a0 + span * f); ctx.stroke(); ctx.shadowBlur = 0;
      const ah = a0 + span * f, hx = cx + Math.cos(ah) * R, hy = cy + Math.sin(ah) * R;
      ctx.beginPath(); ctx.arc(hx, hy, lw * .42, 0, TAU); ctx.fillStyle = '#f2fffb'; ctx.fill();
      if (!REDUCED) { const p = (now % 1700) / 1700; ctx.lineWidth = 1.2; ctx.strokeStyle = rgba(col, (1 - p) * .7); ctx.beginPath(); ctx.arc(hx, hy, lw * .5 + 10 * p, 0, TAU); ctx.stroke(); }
    }
    ctx.lineCap = 'butt';
    const a1x = a0 + span / max, r1 = R - lw / 2 - 3, r2 = R + lw / 2 + 12;
    ctx.strokeStyle = COL.ink2; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a1x) * r1, cy + Math.sin(a1x) * r1); ctx.lineTo(cx + Math.cos(a1x) * r2, cy + Math.sin(a1x) * r2); ctx.stroke();
    ctx.fillStyle = COL.ink3; ctx.font = `500 10px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lab = (a: number, t: string) => { const rr = R + lw / 2 + 22; ctx.fillText(t, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); };
    lab(a1x, '1x'); lab(a0, '0'); lab(a1, fmt.int(max) + 'x');
  }
  function replay() { st.from = 0; st.maxF = st.max; st.t0 = performance.now(); }
  return { resize, setData, draw, replay, el: wrap, visible: true };
}
