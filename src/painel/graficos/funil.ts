import { fmt, ND } from '@/lib/formato';
import type { Visao } from '@/lib/metricas/computar';
import { clamp, ease, lerp } from '@/lib/util';
import { el, type Ambiente, type Componente } from '../ambiente';
import { prepCanvas, rgba, roundRect } from '../desenho';

/* ================= funil ================= */

interface Estagio { nome: string; v: number; meta: number; google: number; conv: [string, number | null] | null; comp?: boolean }

export interface Funil extends Componente {
  setData(V: Visao): void;
  replay(): void;
}

export function criarFunil(amb: Ambiente): Funil {
  const { $, COL, SANS, MONO, REDUCED } = amb;
  const wrap = $('#fWrap'), cv = $<HTMLCanvasElement>('#funil');
  const st = { ctx: null as CanvasRenderingContext2D | null, W: 0, H: 0, stages: null as Estagio[] | null, norm: null as number[] | null, from: [] as number[], target: [] as number[], t0: 0 };
  function resize() {
    const r = wrap.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    st.W = Math.round(r.width); st.H = Math.round(r.height); st.ctx = prepCanvas(cv, st.W, st.H);
  }
  function setData(V: Visao) {
    const f = V.funil, T = V.TL, div = (a: number, b: number) => (b > 0 ? a / b : null);
    st.stages = [
      { nome: 'Impressões', v: f.impressoes, meta: T.meta.impressoes, google: T.google.impressoes, conv: null, comp: true },
      { nome: 'Cliques', v: f.cliques, meta: T.meta.cliques, google: T.google.cliques, conv: ['CTR', div(f.cliques, f.impressoes)] },
      { nome: 'Leads', v: f.leads, meta: T.meta.leads, google: T.google.leads, conv: ['clique → lead', div(f.leads, f.cliques)] },
      { nome: 'Qualificados', v: f.qual.total, meta: f.qual.meta, google: f.qual.google, conv: ['qualificação', div(f.qual.total, f.leads)] },
      { nome: 'Propostas', v: f.prop.total, meta: f.prop.meta, google: f.prop.google, conv: ['proposta', div(f.prop.total, f.qual.total)] },
      { nome: 'Vendas', v: f.vendas.total, meta: f.vendas.meta, google: f.vendas.google, conv: ['fechamento', div(f.vendas.total, f.prop.total)] }
    ];
    const vmax = Math.max(10, st.stages[0].v);
    st.target = st.stages.map(s => (s.v > 0 ? Math.log10(1 + s.v) / Math.log10(1 + vmax) : 0));
    st.from = st.norm ? st.norm.slice() : st.target.map(() => 0);
    st.t0 = performance.now();
    cv.setAttribute('aria-label', 'Funil das campanhas de lead: ' + st.stages.map(s => `${s.nome} ${fmt.int(s.v)}`).join(', ') + '. Largura das barras em escala logarítmica.');
    const tb = $('#fTable'); tb.textContent = '';
    tb.append(el('caption', '', 'Funil das campanhas de lead'));
    const head = el('tr'); ['Etapa', 'Total', 'Meta Ads', 'Google Ads', 'Conversão da etapa anterior'].forEach(t => head.append(el('th', '', t))); tb.append(head);
    st.stages.forEach(s => { const tr = el('tr'); [s.nome, fmt.int(s.v), fmt.int(s.meta), fmt.int(s.google), s.conv ? (s.conv[1] == null ? ND : fmt.pct(s.conv[1])) : ''].forEach(t => tr.append(el('td', '', t))); tb.append(tr); });
  }
  function draw(now: number) {
    const { ctx, W, H } = st;
    if (!ctx || !st.stages) return;
    ctx.clearRect(0, 0, W, H);
    const e = REDUCED ? 1 : ease.out(clamp((now - st.t0) / 1000, 0, 1));
    const norm = st.target.map((t, k) => lerp(st.from[k] || 0, t, e));
    st.norm = norm;
    const n = st.stages.length, rowH = H / n, labW = clamp(W * .34, 84, 130), convW = clamp(W * .24, 60, 82), bx0 = labW, bw = Math.max(40, W - labW - convW - 8);
    const tight = rowH < 36;
    for (let k = 0; k < n; k++) {
      const s = st.stages[k], cy = k * rowH + rowH / 2;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = COL.ink3; ctx.font = `500 10.5px ${SANS}`; ctx.fillText(s.nome, 0, cy - (tight ? 4 : 5));
      ctx.fillStyle = COL.ink; ctx.font = `400 ${tight ? 14 : 15}px ${SANS}`; ctx.fillText(s.comp ? fmt.comp(s.v) : fmt.int(s.v), 0, cy + (tight ? 11.5 : 13));
      ctx.fillStyle = COL.hair; roundRect(ctx, bx0, cy - 4, bw, 8, 4); ctx.fill();
      const w = Math.max(s.v > 0 ? 6 : 0, bw * (norm[k] || 0));
      if (w > 0) {
        const col = k === n - 1 ? COL.good : COL.st[Math.min(k, 4)];
        const g = ctx.createLinearGradient(bx0, 0, bx0 + w, 0); g.addColorStop(0, rgba(col, .5)); g.addColorStop(1, col);
        ctx.fillStyle = g; ctx.shadowColor = rgba(col, .7); ctx.shadowBlur = 10; roundRect(ctx, bx0, cy - 4, w, 8, 4); ctx.fill(); ctx.shadowBlur = 0;
        if (!REDUCED && w > 20) {
          const gx = bx0 + ((now / 2200 + k * .17) % 1) * w, gg = ctx.createLinearGradient(gx - 24, 0, gx + 24, 0);
          gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(.5, 'rgba(255,255,255,.45)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.save(); roundRect(ctx, bx0, cy - 4, w, 8, 4); ctx.clip(); ctx.fillStyle = gg; ctx.fillRect(gx - 24, cy - 4, 48, 8); ctx.restore();
        }
        const tot = s.meta + s.google;
        if (tot > 0) {
          const both = s.meta > 0 && s.google > 0, wm = (w - (both ? 2 : 0)) * s.meta / tot, y2 = cy + 8;
          if (s.meta > 0) { ctx.fillStyle = COL.meta; ctx.fillRect(bx0, y2, Math.max(1, wm), 2); }
          if (s.google > 0) { ctx.fillStyle = COL.google; ctx.fillRect(bx0 + wm + (both ? 2 : 0), y2, Math.max(1, w - wm - (both ? 2 : 0)), 2); }
        }
      }
      if (s.conv) {
        ctx.textAlign = 'right';
        ctx.fillStyle = COL.ink; ctx.font = `500 12px ${MONO}`; ctx.fillText(s.conv[1] == null ? ND : fmt.pct(s.conv[1]), W, cy + 1);
        ctx.fillStyle = COL.ink3; ctx.font = `500 9.5px ${SANS}`; ctx.fillText(s.conv[0], W, cy + 14);
      }
    }
  }
  function replay() { if (!st.stages) return; st.from = st.target.map(() => 0); st.t0 = performance.now(); }
  return { resize, setData, draw, replay, el: wrap, visible: true };
}
