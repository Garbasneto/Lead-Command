import { clamp, ease, TAU } from '@/lib/util';
import type { Ambiente } from './ambiente';

/* Utilidades de desenho em Canvas 2D, portadas do protótipo. */

export function rgba(hex: string, a: number) {
  let h = String(hex || '#000').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
export function glowSprite(hex: string, core: number) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(255,255,255,${core})`); gr.addColorStop(.16, rgba(hex, .95)); gr.addColorStop(.42, rgba(hex, .32)); gr.addColorStop(1, rgba(hex, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
}
export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }
export function topoArredondado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { r = Math.max(0, Math.min(r, w / 2, h)); ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h); ctx.closePath(); }

export interface Escala { max: number; step: number }
export function niceMax(v: number, n: number, inteiro: boolean): Escala {
  if (!(v > 0)) return { max: n, step: 1 };
  const raw = v / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
  let step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  if (inteiro) step = step < 1 ? 1 : Math.ceil(step);
  return { max: step * Math.ceil(v / step - 1e-9), step };
}
export function msgVazio(amb: Ambiente, ctx: CanvasRenderingContext2D, W: number, H: number, t: string) {
  ctx.fillStyle = amb.COL.ink3; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `500 12px ${amb.SANS}`;
  ctx.fillText(t, W / 2, H / 2);
}
export function larguraTicks(ctx: CanvasRenderingContext2D, sc: Escala, f: (v: number) => string) {
  let w = 0;
  for (let v = 0; v <= sc.max + 1e-6; v += sc.step) w = Math.max(w, ctx.measureText(f(v)).width);
  return w;
}
export function prepCanvas(cv: HTMLCanvasElement, w: number, h: number, cap?: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, cap || 2);
  cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
  const ctx = cv.getContext('2d')!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return ctx;
}
export function sparkline(amb: Ambiente, cv: HTMLCanvasElement, vals: (number | null)[], color: string, anim: boolean) {
  const w = cv.clientWidth || 100, h = cv.clientHeight || 40;
  const ctx = prepCanvas(cv, w, h);
  const token = (amb.tokens.get(cv) || 0) + 1; amb.tokens.set(cv, token);
  const pts: [number, number][] = []; vals.forEach((v, i) => { if (v != null && isFinite(v)) pts.push([i, v]); });
  ctx.clearRect(0, 0, w, h);
  if (pts.length < 2) return;
  let min = Infinity, max = -Infinity; for (const [, v] of pts) { if (v < min) min = v; if (v > max) max = v; }
  min = Math.min(min, 0);
  const span = max - min || 1, n = vals.length;
  const X = (i: number) => 3 + (w - 8) * (n > 1 ? i / (n - 1) : .5);
  const Y = (v: number) => h - 3 - (v - min) / span * (h - 8);
  const D = anim && !amb.REDUCED ? 900 : 0, t0 = performance.now();
  const frame = (now: number) => {
    if (amb.tokens.get(cv) !== token) return;
    const p = D ? clamp((now - t0) / D, 0, 1) : 1;
    const upto = pts[0][0] + (pts[pts.length - 1][0] - pts[0][0]) * ease.out(p);
    ctx.clearRect(0, 0, w, h);
    const vis = pts.filter(q => q[0] <= upto + 1e-6);
    if (vis.length >= 2) {
      const path = () => { ctx.beginPath(); vis.forEach(([i, v], k) => { if (k) ctx.lineTo(X(i), Y(v)); else ctx.moveTo(X(i), Y(v)); }); };
      path(); ctx.lineTo(X(vis[vis.length - 1][0]), h); ctx.lineTo(X(vis[0][0]), h); ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, rgba(color, .2)); g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g; ctx.fill();
      path(); ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.shadowColor = rgba(color, .6); ctx.shadowBlur = 6; ctx.stroke(); ctx.shadowBlur = 0;
      if (p >= 1) {
        const [li, lv] = vis[vis.length - 1];
        ctx.beginPath(); ctx.arc(X(li), Y(lv), 4, 0, TAU); ctx.fillStyle = amb.COL.surface; ctx.fill();
        ctx.beginPath(); ctx.arc(X(li), Y(lv), 2.4, 0, TAU); ctx.fillStyle = color; ctx.fill();
      }
    }
    if (p < 1) amb.raf(frame);
  };
  amb.raf(frame);
}
