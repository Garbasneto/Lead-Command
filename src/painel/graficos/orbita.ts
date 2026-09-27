import { rngDe } from '@/lib/aleatorio';
import { ETAPA_NOME, ETAPAS_ABERTAS } from '@/lib/etapas';
import { fmt } from '@/lib/formato';
import type { Visao } from '@/lib/metricas/computar';
import type { Campanha, Dados, Etapa, EtapaAberta, Negocio } from '@/lib/tipos';
import { clamp, DAY, ease, lerp, TAU } from '@/lib/util';
import { el, type Ambiente, type Componente } from '../ambiente';
import { glowSprite, prepCanvas, rgba, roundRect } from '../desenho';

/* ================= órbita do pipeline ================= */

type Tipo = 'pre' | 'open' | 'won' | 'lost';
interface Dot {
  d: Negocio; th: number; jit: number; ph: number; vf: number; r: number; a: number; kind: Tipo; gone: boolean;
  tilt: number; rr: number; pend: boolean; sx: number; sy: number; ps: number; pz: number; vis: boolean;
  e: Etapa | undefined; em: number | undefined;
}
interface Alvo { kind: Tipo; r: number; a: number; e?: Etapa; em?: number; k?: number }
interface Ponto { x: number; y: number; s: number; z: number }
interface Rotulo { k: number; x: number; y: number; w: number; h: number }

export interface Orbita extends Componente {
  setData(V: Visao, opts?: { snap?: boolean }): void;
  highlight(k: EtapaAberta | null): void;
  replay(delay?: number): void;
  intro(): void;
}

export function criarOrbita(amb: Ambiente, DATA: Dados, CAMP: Record<string, Campanha>): Orbita {
  const { $, $$, COL, SANS, MONO, SRC, REDUCED, FINE, signal } = amb;
  const stageEl = $('#stage3d'), cv = $<HTMLCanvasElement>('#orbit'), tip = $('#otip');
  const RINGS: { k: EtapaAberta; r: number }[] = [{ k: 'novo', r: 9.5 }, { k: 'contato', r: 7.95 }, { k: 'qualificado', r: 6.45 }, { k: 'proposta', r: 5.0 }, { k: 'negociacao', r: 3.6 }];
  const IDX: Record<string, number> = { novo: 0, contato: 1, qualificado: 2, proposta: 3, negociacao: 4 };
  const RC = COL.st;
  const RB = 10.7, RCORE = 1.12, D0 = 30;
  const st = {
    ctx: null as CanvasRenderingContext2D | null, W: 0, H: 0, visible: true,
    yaw: -.65, yawV: 0, elev: .5, elevT: .5, elevSet: false, D: D0, f: 600, cx: 0, cy: 0, top: 96, bottom: 24,
    dots: new Map<number, Dot>(), t0: 0, t1: 0, tSim: 0,
    replay: null as { start: number; dur: number; p: number } | null, intro: null as number | null, introQ: 1,
    hover: null as Dot | null, pin: null as Dot | null, hl: null as number | null, hlFrom: null as string | null,
    drag: null as { id: number; x: number; y: number; yaw: number; elev: number; moved: boolean; lx: number; lt: number } | null, lastInt: 0,
    flash: 0, shocks: [] as number[], labels: [] as Rotulo[], counts: [0, 0, 0, 0, 0], wonSim: 0, recSim: 0,
    dust: [] as { r: number; th: number; y: number; w: number; s: number; a: number }[],
    comets: [] as { k: number; th: number; sp: number; tr: [number, number][] }[], sweep: 0, dustN: 0
  };
  const SPR = { meta: glowSprite(COL.meta, .95), google: glowSprite(COL.google, .95), won: glowSprite('#dffcf6', 1), bad: glowSprite(COL.bad, .7), teal: glowSprite(COL.accent, .8) };
  const PHI = (1 + Math.sqrt(5)) / 2;
  const IV = [[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]]
    .map(v => { const n = Math.hypot(v[0], v[1], v[2]); return v.map(c => c / n); });
  const IE: [number, number][] = [];
  for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) if (Math.hypot(IV[a][0] - IV[b][0], IV[a][1] - IV[b][1], IV[a][2] - IV[b][2]) < 1.1) IE.push([a, b]);

  function initDust(n: number) {
    const r = rngDe('poeira');
    st.dust = Array.from({ length: n }, () => { const rr = Math.sqrt(r()) * 12.8; return { r: rr, th: r() * TAU, y: (r() - .5) * 1.8 * (1 - rr / 15), w: .015 + r() * .03, s: .6 + r() * .9, a: .25 + r() * .5 }; });
    st.dustN = n;
  }
  st.comets = [{ k: 0, th: 0, sp: .8, tr: [] }, { k: 2, th: 3, sp: 1.1, tr: [] }];

  let cY = 1, sY = 0, cE = 1, sE = 0;
  function projV(x1: number, y: number, z1: number): Ponto { const y2 = y * cE - z1 * sE, z2 = y * sE + z1 * cE, s = st.f / (st.D - z2); return { x: st.cx + x1 * s, y: st.cy - y2 * s, s, z: z2 }; }
  function proj(x: number, y: number, z: number) { return projV(x * cY - z * sY, y, x * sY + z * cY); }

  function resize() {
    const r = stageEl.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    st.W = Math.round(r.width); st.H = Math.round(r.height);
    st.ctx = prepCanvas(cv, st.W, st.H, st.W < 700 ? 1.75 : 2);
    const mobile = st.W < 560;
    const ask = $('#ask');
    const overlay = ask && !ask.hidden && getComputedStyle(ask).position === 'absolute';
    const ov = stageEl.querySelector('.ov-top')!.getBoundingClientRect();
    const rp = $('#replay'), rr = rp.hidden ? null : rp.getBoundingClientRect();
    let top = ov.bottom - r.top + 10, bottom = mobile ? 18 : 22;
    if (rr && rr.height) {
      if (rr.top - r.top < r.height / 2) top = Math.max(top, rr.bottom - r.top + 10);
      else bottom = Math.max(bottom, r.bottom - rr.top + 10);
    }
    if (overlay) bottom = Math.max(bottom, ask.offsetHeight + 30);
    st.top = top; st.bottom = bottom;
    if (!st.elevSet) {
      const avail = Math.max(120, st.H - top - bottom);
      st.elevT = Math.asin(clamp(.78 * avail / (.91 * st.W), Math.sin(.42), Math.sin(.7)));
      if (!st.intro) st.elev = st.elevT;
    }
    const want = mobile ? 150 : 360;
    if (st.dustN !== want) initDust(want);
  }
  function fit() {
    const se = Math.sin(st.elev), ce = Math.cos(st.elev), R = RB + .35;
    const kT = R * se / (D0 + R * ce), kB = R * se / (D0 - R * ce);
    const avail = Math.max(120, st.H - st.top - st.bottom);
    const fW = st.W * .455 * D0 / R, fH = (avail - 36) / (kT + kB);
    st.f = Math.max(60, Math.min(fW, fH));
    st.cx = st.W / 2;
    st.cy = st.top + 36 + kT * st.f + Math.max(0, (avail - 36 - (kT + kB) * st.f) / 2);
  }
  function alvo(dot: Dot, t: number): Alvo {
    const d = dot.d;
    if (dot.gone) return { kind: dot.kind, r: dot.r, a: 0, e: dot.e, em: dot.em };
    if (t < d.criadoEm) return { kind: 'pre', r: RB + 1.4, a: 0 };
    let e: Etapa = 'novo', em = d.criadoEm;
    for (const h of d.hist) { if (h.em <= t) { e = h.etapa; em = h.em; } else break; }
    if (e === 'ganho') return { kind: 'won', r: dot.rr, a: 1, e, em };
    if (e === 'perdido') return { kind: 'lost', r: RB + 1.8, a: 0, e, em };
    return { kind: 'open', k: IDX[e], r: RINGS[IDX[e]].r + dot.jit, a: 1, e, em };
  }
  function setData(V: Visao, opts?: { snap?: boolean }) {
    const o = opts || {};
    st.t0 = DATA.datas[V.win.a].getTime(); st.t1 = DATA.agora;
    const ids = new Set<number>();
    for (const d of V.coorte) {
      ids.add(d.id);
      let dot = st.dots.get(d.id);
      if (!dot) {
        const r = rngDe('orb|' + d.id);
        dot = { d, th: r() * TAU, jit: (r() - .5) * .5, ph: r() * 6.28, vf: 0, r: RB + 1.4, a: 0, kind: 'pre', gone: false, tilt: .4 + r() * .9, rr: 1.75 + r() * .75, pend: false, sx: -99, sy: -99, ps: 1, pz: 0, vis: false, e: 'novo', em: d.criadoEm };
        st.dots.set(d.id, dot);
      }
      dot.d = d; dot.gone = false; dot.vf = clamp((d.valor - 2200) / 5000, 0, 1);
    }
    for (const [id, dot] of st.dots) if (!ids.has(id)) dot.gone = true;
    if (o.snap || REDUCED) {
      for (const [id, dot] of st.dots) {
        if (dot.gone) { st.dots.delete(id); continue; }
        const t = alvo(dot, st.t1); dot.kind = t.kind; dot.r = t.r; dot.a = t.a; dot.e = t.e; dot.em = t.em; dot.pend = false;
      }
    }
    const nomes = ETAPAS_ABERTAS.map(k => `${ETAPA_NOME[k]} ${V.pipe[k].n}`).join(', ');
    cv.setAttribute('aria-label', `Órbita do pipeline, leads dos últimos ${V.periodo} dias: ${nomes}. ${V.funil.vendas.total} vendas no núcleo, ${fmt.money(V.roi.receita)}.`);
    $('#orbitSub').textContent = `Leads dos últimos ${V.periodo} dias em cada etapa · ${FINE ? 'arraste para girar' : 'toque e arraste para girar'}`;
    if (REDUCED) amb.raf(() => draw(performance.now(), 0));
  }
  function replayUI(p: number | null) {
    const btn = $('#btnReplay'), bar = $('#rbar'), lbl = $('#rdate');
    if (p == null) { bar.style.width = '0%'; lbl.textContent = ''; btn.querySelector('span')!.textContent = 'Replay do período'; return; }
    bar.style.width = (p * 100).toFixed(1) + '%'; lbl.textContent = fmt.dm(new Date(st.tSim)); btn.querySelector('span')!.textContent = 'Pular replay';
  }
  function iniciarReplay(delay?: number) {
    if (REDUCED) return;
    st.replay = { start: performance.now() + (delay || 0), dur: 6500, p: 0 };
    for (const dot of st.dots.values()) { if (dot.gone) continue; dot.kind = 'pre'; dot.r = RB + 1.4; dot.a = 0; dot.pend = false; }
  }
  function iniciarIntro() { if (REDUCED) return; st.intro = performance.now(); st.introQ = 0; }
  function atualizarDots(now: number, dt: number, tSim: number) {
    const counts = [0, 0, 0, 0, 0]; let won = 0, rec = 0;
    for (const [id, dot] of st.dots) {
      const t = alvo(dot, tSim);
      if (t.kind !== dot.kind) { if (t.kind === 'won' && !REDUCED) dot.pend = true; dot.kind = t.kind; }
      dot.e = t.e; dot.em = t.em;
      const kr = 1 - Math.exp(-dt * (t.kind === 'lost' ? 1.05 : t.kind === 'won' ? 2.1 : 3.3));
      const ka = 1 - Math.exp(-dt * (t.kind === 'lost' || dot.gone ? 1.25 : 4.5));
      dot.r += (t.r - dot.r) * kr; dot.a += (t.a - dot.a) * ka;
      if (dot.gone && dot.a < .01) { st.dots.delete(id); continue; }
      if (!REDUCED) dot.th += (dot.kind === 'won' ? 1.2 : .95 / Math.pow(Math.max(dot.r, 2.2), .95)) * dt;
      if (dot.pend && dot.r < dot.rr + .55) { dot.pend = false; st.flash = 1; st.shocks.push(now); }
      if (dot.gone) continue;
      if (dot.kind === 'open') counts[t.k as number]++;
      else if (dot.kind === 'won') { won++; rec += dot.d.valor; }
    }
    st.counts = counts; st.wonSim = won; st.recSim = rec;
  }
  function ringFrac(k: number) { return st.intro ? clamp((st.introQ - .1 - k * .06) / .5, 0, 1) : 1; }
  function anel(ctx: CanvasRenderingContext2D, r: number, color: string, alpha: number, lw: number, frac: number, glow: boolean) {
    const SEG = 96, last = Math.round(SEG * frac);
    if (last <= 0) return;
    const pts: Ponto[] = []; for (let i = 0; i <= last; i++) { const a = i / SEG * TAU - 1.2 - st.yaw; pts.push(proj(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = 10; }
    for (let c = 0; c < last; c += 8) {
      const mid = pts[Math.min(c + 4, last)], front = clamp((mid.z / (r * cE + 1e-6) + 1) / 2, 0, 1);
      ctx.strokeStyle = rgba(color, alpha * (.25 + .75 * front)); ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(pts[c].x, pts[c].y);
      for (let i = c + 1; i <= Math.min(c + 8, last); i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }
  function desenharDots(ctx: CanvasRenderingContext2D, list: Dot[], now: number) {
    ctx.globalCompositeOperation = 'lighter';
    for (const dot of list) {
      const mine = st.hl != null && dot.kind === 'open' && IDX[dot.e as string] === st.hl;
      let alpha = dot.a * (st.hl != null && !mine ? .16 : 1);
      alpha *= .55 + .45 * clamp((dot.pz / 11 + 1) / 2, 0, 1);
      const spr = dot.kind === 'won' ? SPR.won : dot.kind === 'lost' ? SPR.bad : SPR[dot.d.fonte];
      const rpx = (.085 + .055 * dot.vf) * dot.ps * (dot.kind === 'won' ? 1.4 : 1) * (mine ? 1.35 : 1) * (st.hover === dot || st.pin === dot ? 1.5 : 1);
      const size = Math.max(5, rpx * 9);
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.drawImage(spr, dot.sx - size / 2, dot.sy - size / 2, size, size);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    for (const dot of list) {
      if (dot.kind !== 'open' || dot.a < .5 || st.replay) continue;
      if ((st.tSim - (dot.em as number)) / DAY < 7) continue;
      const rr = (.085 + .055 * dot.vf) * dot.ps * 2.6, pul = REDUCED ? .6 : .45 + .35 * Math.sin(now / 500 + dot.ph);
      ctx.strokeStyle = rgba(COL.bad, pul * (st.hl != null && IDX[dot.e as string] !== st.hl ? .25 : 1)); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(dot.sx, dot.sy, Math.max(4, rr), 0, TAU); ctx.stroke();
    }
    for (const dot of list) {
      if (dot !== st.hover && dot !== st.pin) continue;
      ctx.strokeStyle = 'rgba(240,255,252,.9)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(dot.sx, dot.sy, Math.max(7, dot.ps * .45), 0, TAU); ctx.stroke();
    }
  }
  function desenharNucleo(ctx: CanvasRenderingContext2D, o: Ponto, now: number, dt: number) {
    const sc = st.intro ? ease.back(clamp((st.introQ - .15) / .6, 0, 1)) : 1;
    const rc = RCORE * o.s * sc;
    if (rc <= .5) return;
    st.flash = Math.max(0, st.flash - dt * 1.5);
    const pul = REDUCED ? .5 : .5 + .5 * Math.sin(now / 1000 * 2.1);
    const R1 = rc * (4.4 + 1.8 * st.flash);
    ctx.globalCompositeOperation = 'lighter';
    const g1 = ctx.createRadialGradient(o.x, o.y, rc * .5, o.x, o.y, R1);
    g1.addColorStop(0, `rgba(94,234,212,${(.3 + .07 * pul + .4 * st.flash).toFixed(3)})`); g1.addColorStop(1, 'rgba(94,234,212,0)');
    ctx.fillStyle = g1; ctx.beginPath(); ctx.arc(o.x, o.y, R1, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    const g2 = ctx.createRadialGradient(o.x - rc * .35, o.y - rc * .42, rc * .08, o.x, o.y, rc);
    g2.addColorStop(0, '#f3fffd'); g2.addColorStop(.3, '#8ff5e4'); g2.addColorStop(.72, '#138a7b'); g2.addColorStop(1, '#073b35');
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(o.x, o.y, rc, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(210,255,248,.35)'; ctx.lineWidth = 1; ctx.stroke();
    const t = REDUCED ? 0 : now / 1000, ca = Math.cos(t * .5), sa = Math.sin(t * .5), cb = Math.cos(t * .31), sb = Math.sin(t * .31);
    const R = RCORE * 1.55 * sc;
    const pv = IV.map(([x, y, z]) => { const x1 = x * ca - z * sa, z1 = x * sa + z * ca, y1 = y * cb - z1 * sb, z2 = y * sb + z1 * cb; return proj(x1 * R, y1 * R, z2 * R); });
    ctx.lineWidth = 1;
    for (const [a, b] of IE) { const zz = (pv[a].z + pv[b].z) / 2; ctx.strokeStyle = zz >= 0 ? 'rgba(150,245,230,.42)' : 'rgba(150,245,230,.13)'; ctx.beginPath(); ctx.moveTo(pv[a].x, pv[a].y); ctx.lineTo(pv[b].x, pv[b].y); ctx.stroke(); }
    ctx.globalCompositeOperation = 'lighter';
    for (const p of pv) { ctx.globalAlpha = p.z >= 0 ? .85 : .3; ctx.drawImage(SPR.teal, p.x - 3.5, p.y - 3.5, 7, 7); }
    ctx.globalAlpha = 1;
    if (st.flash > .02) {
      const hgt = rc * 8 * st.flash, lg = ctx.createLinearGradient(o.x, o.y - rc, o.x, o.y - rc - hgt);
      lg.addColorStop(0, `rgba(200,255,246,${(.65 * st.flash).toFixed(3)})`); lg.addColorStop(1, 'rgba(200,255,246,0)');
      ctx.fillStyle = lg; ctx.fillRect(o.x - 1.5, o.y - rc - hgt, 3, hgt);
    }
    ctx.globalCompositeOperation = 'source-over';
    st.shocks = st.shocks.filter(s0 => now - s0 < 1300);
    for (const s0 of st.shocks) {
      const a = (now - s0) / 1300, r = RCORE + a * 7.5;
      ctx.strokeStyle = `rgba(160,250,235,${((1 - a) * .55).toFixed(3)})`; ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let i = 0; i <= 56; i++) { const an = i / 56 * TAU, p = proj(Math.cos(an) * r, 0, Math.sin(an) * r); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }
      ctx.stroke();
    }
  }
  function desenharRotulos(ctx: CanvasRenderingContext2D, o: Ponto) {
    st.labels = [];
    const psi = st.W < 560 ? 2.0 : 2.4, H = 21, L: { k: number; p: Ponto; name: string; cnt: string; w1: number; w: number; y: number }[] = [];
    RINGS.forEach((rg, k) => {
      if (ringFrac(k) < .98) return;
      const p = projV(Math.cos(psi) * rg.r, 0, Math.sin(psi) * rg.r);
      const name = ETAPA_NOME[rg.k], cnt = fmt.int(st.counts[k] || 0);
      ctx.font = `500 11px ${SANS}`; const w1 = ctx.measureText(name).width;
      ctx.font = `600 11.5px ${SANS}`; const w2 = ctx.measureText(cnt).width;
      L.push({ k, p, name, cnt, w1, w: w1 + w2 + 22, y: p.y - H / 2 });
    });
    if (L.length) {
      // separa os rótulos na vertical e recentra o grupo nas âncoras
      L.sort((a, b) => a.y - b.y);
      const alvoMedio = L.reduce((s, l) => s + l.y, 0) / L.length;
      for (let i = 1; i < L.length; i++) if (L[i].y < L[i - 1].y + H + 4) L[i].y = L[i - 1].y + H + 4;
      const sh = alvoMedio - L.reduce((s, l) => s + l.y, 0) / L.length;
      L.forEach(l => { l.y = clamp(l.y + sh, 4, st.H - H - 4); });
      const xr = Math.min(...L.map(l => l.p.x)) - 16;
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      for (const l of L) {
        const x = Math.max(4, xr - l.w), y = l.y, cy = y + H / 2, hl = st.hl === l.k, col = RC[l.k];
        ctx.strokeStyle = rgba(col, .7); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + l.w, cy + .5); ctx.lineTo(l.p.x - 3, l.p.y); ctx.stroke();
        ctx.fillStyle = hl ? 'rgba(16,52,48,.95)' : 'rgba(5,10,12,.82)'; roundRect(ctx, x, y, l.w, H, 10.5); ctx.fill();
        ctx.strokeStyle = hl ? rgba(COL.accent, .7) : rgba(col, .6); ctx.stroke();
        ctx.fillStyle = COL.ink2; ctx.font = `500 11px ${SANS}`; ctx.fillText(l.name, x + 8, cy + .5);
        ctx.fillStyle = COL.ink; ctx.font = `600 11.5px ${SANS}`; ctx.fillText(l.cnt, x + 14 + l.w1, cy + .5);
        ctx.fillStyle = hl ? COL.accent : col; ctx.beginPath(); ctx.arc(l.p.x, l.p.y, 2.4, 0, TAU); ctx.fill();
        st.labels.push({ k: l.k, x, y, w: l.w, h: H });
      }
    }
    if (st.intro && st.introQ < .6) return;
    const rc = RCORE * o.s;
    const t1 = `${fmt.int(st.wonSim)} ${st.wonSim === 1 ? 'venda' : 'vendas'}`, t2 = fmt.money(st.recSim);
    ctx.textAlign = 'center';
    ctx.font = `600 12px ${SANS}`; const wa = ctx.measureText(t1).width;
    ctx.font = `500 11px ${MONO}`; const wb = ctx.measureText(t2).width;
    const w = Math.max(wa, wb) + 22, h = 38, x = o.x - w / 2, y = o.y - rc * 2.25 - h;
    ctx.fillStyle = 'rgba(5,10,12,.76)'; roundRect(ctx, x, y, w, h, 11); ctx.fill();
    ctx.strokeStyle = 'rgba(190,255,245,.22)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = COL.ink; ctx.font = `600 12px ${SANS}`; ctx.fillText(t1, o.x, y + 13);
    ctx.fillStyle = COL.good; ctx.font = `500 11px ${MONO}`; ctx.fillText(t2, o.x, y + 27);
    ctx.textAlign = 'left';
  }
  function draw(now: number, dt?: number) {
    const ctx = st.ctx;
    if (!ctx) return;
    dt = dt || 0;
    if (st.intro) {
      const q = clamp((now - st.intro) / 2000, 0, 1), e = ease.out(q);
      st.introQ = q; st.D = lerp(64, D0, e); st.elev = lerp(1.18, st.elevT, e); st.yaw += dt * (1 - e) * 1.5;
      if (q >= 1) { st.intro = null; st.introQ = 1; }
    } else { st.D = D0; st.elev += (st.elevT - st.elev) * (1 - Math.exp(-dt * 6)); }
    if (!st.drag) {
      st.yaw += st.yawV * dt; st.yawV *= Math.exp(-dt * 2.4);
      if (!REDUCED && now - st.lastInt > 2600) st.yaw += dt * .045;
    }
    cY = Math.cos(st.yaw); sY = Math.sin(st.yaw); cE = Math.cos(st.elev); sE = Math.sin(st.elev);
    fit();
    st.tSim = st.t1;
    if (st.replay) {
      const p = clamp((now - st.replay.start) / st.replay.dur, 0, 1);
      st.replay.p = p; st.tSim = lerp(st.t0, st.t1, ease.inOut(p));
      replayUI(p);
      if (p >= 1) { st.replay = null; replayUI(null); }
    }
    atualizarDots(now, dt, st.tSim);
    ctx.clearRect(0, 0, st.W, st.H);
    const o = proj(0, 0, 0), vis = st.introQ;

    { const rx = (RB + .8) * o.s;
      ctx.save(); ctx.translate(o.x, o.y); ctx.scale(1, Math.max(.05, sE));
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, `rgba(45,212,191,${(.12 * vis).toFixed(3)})`); g.addColorStop(.55, `rgba(45,212,191,${(.04 * vis).toFixed(3)})`); g.addColorStop(1, 'rgba(45,212,191,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill(); ctx.restore(); }

    if (!REDUCED) st.sweep += dt * .5;
    if (vis > .5) {
      const A = st.sweep, span = .8, n = 12;
      for (let j = 0; j < n; j++) {
        const a0 = A - span + span * j / n, a1 = A - span + span * (j + 1) / n;
        const p1 = proj(Math.cos(a0) * 1.5, 0, Math.sin(a0) * 1.5), p2 = proj(Math.cos(a0) * RB, 0, Math.sin(a0) * RB);
        const p3 = proj(Math.cos(a1) * RB, 0, Math.sin(a1) * RB), p4 = proj(Math.cos(a1) * 1.5, 0, Math.sin(a1) * 1.5);
        ctx.fillStyle = `rgba(94,234,212,${(.005 + .05 * Math.pow((j + 1) / n, 2.2)).toFixed(4)})`;
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.closePath(); ctx.fill();
      }
      const e1 = proj(Math.cos(A) * 1.5, 0, Math.sin(A) * 1.5), e2 = proj(Math.cos(A) * RB, 0, Math.sin(A) * RB);
      const lg = ctx.createLinearGradient(e1.x, e1.y, e2.x, e2.y); lg.addColorStop(0, 'rgba(94,234,212,0)'); lg.addColorStop(1, 'rgba(94,234,212,.4)');
      ctx.strokeStyle = lg; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(e1.x, e1.y); ctx.lineTo(e2.x, e2.y); ctx.stroke();
    }

    anel(ctx, RB, '#a0f0e6', .5 * vis, 1, st.intro ? clamp(st.introQ / .5, 0, 1) : 1, false);
    anel(ctx, RB + .6, '#a0f0e6', .2 * vis, 1, st.intro ? clamp((st.introQ - .1) / .5, 0, 1) : 1, false);
    if (vis > .3) {
      const pf = new Path2D(), pb = new Path2D();
      for (let i = 0; i < 120; i++) {
        const a = i / 120 * TAU, r2 = RB + (i % 10 === 0 ? .5 : .22);
        const q1 = proj(Math.cos(a) * RB, 0, Math.sin(a) * RB), q2 = proj(Math.cos(a) * r2, 0, Math.sin(a) * r2);
        const P = q1.z >= 0 ? pf : pb; P.moveTo(q1.x, q1.y); P.lineTo(q2.x, q2.y);
      }
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(160,240,230,.1)'; ctx.stroke(pb); ctx.strokeStyle = 'rgba(160,240,230,.3)'; ctx.stroke(pf);
    }
    RINGS.forEach((rg, k) => { const hl = st.hl === k; anel(ctx, rg.r, hl ? COL.accent : RC[k], hl ? 1 : .8, hl ? 1.6 : 1.05, ringFrac(k), hl); });

    ctx.globalCompositeOperation = 'lighter';
    for (const p of st.dust) {
      if (!REDUCED) p.th += p.w * dt;
      const q = proj(Math.cos(p.th) * p.r, p.y, Math.sin(p.th) * p.r);
      const fr = clamp((q.z / 12 + 1) / 2, 0, 1), s = p.s * q.s * .05;
      ctx.fillStyle = `rgba(170,245,235,${(p.a * (.2 + .6 * fr) * vis).toFixed(3)})`;
      ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
    }
    if (!REDUCED && vis > .8) {
      for (const c of st.comets) {
        const r = RINGS[c.k].r; c.th += c.sp * dt * .35;
        const q = proj(Math.cos(c.th) * r, 0, Math.sin(c.th) * r);
        c.tr.push([q.x, q.y]); if (c.tr.length > 16) c.tr.shift();
        for (let i = 1; i < c.tr.length; i++) { ctx.strokeStyle = `rgba(160,250,240,${(i / c.tr.length * .32).toFixed(3)})`; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(c.tr[i - 1][0], c.tr[i - 1][1]); ctx.lineTo(c.tr[i][0], c.tr[i][1]); ctx.stroke(); }
        ctx.drawImage(SPR.teal, q.x - 5, q.y - 5, 10, 10);
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    const back: Dot[] = [], front: Dot[] = [];
    for (const dot of st.dots.values()) {
      if (dot.a < .02) { dot.vis = false; continue; }
      const blend = dot.kind === 'won' ? clamp((3.4 - dot.r) / (3.4 - dot.rr), 0, 1) : 0;
      const tl = dot.tilt * blend, pz = Math.sin(dot.th) * dot.r;
      const x = Math.cos(dot.th) * dot.r, y = pz * Math.sin(tl) + (REDUCED ? 0 : Math.sin(now / 900 + dot.ph) * .06 * (1 - blend)), z = pz * Math.cos(tl);
      const q = proj(x, y, z);
      dot.sx = q.x; dot.sy = q.y; dot.ps = q.s; dot.pz = q.z; dot.vis = true;
      (q.z < 0 ? back : front).push(dot);
    }
    back.sort((a, b) => a.pz - b.pz); front.sort((a, b) => a.pz - b.pz);
    desenharDots(ctx, back, now);
    desenharNucleo(ctx, o, now, dt);
    desenharDots(ctx, front, now);
    desenharRotulos(ctx, o);
    if (st.pin && (!st.pin.vis || st.pin.a < .2)) { st.pin = null; tip.hidden = true; }
    if (st.hover || st.pin) posicionarTip(st.pin || st.hover);
  }

  function pontoMaisProximo(mx: number, my: number) {
    let best: Dot | null = null, bd = 16 * 16;
    for (const dot of st.dots.values()) {
      if (!dot.vis || dot.a < .35) continue;
      const dx = dot.sx - mx, dy = dot.sy - my, d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = dot; }
    }
    return best;
  }
  function rotuloEm(mx: number, my: number) { for (const l of st.labels) if (mx >= l.x && mx <= l.x + l.w && my >= l.y && my <= l.y + l.h) return l.k; return null; }
  function preencherTip(dot: Dot) {
    const d = dot.d, c = CAMP[d.campanhaId];
    tip.textContent = '';
    const t1 = el('div', 't1'); const sw = el('i'); sw.style.setProperty('--c', SRC[d.fonte].cor); t1.append(sw, document.createTextNode(`#${d.id} · ${SRC[d.fonte].nome}`));
    const t2 = el('div', 't2', c.nome);
    const t3 = el('div', 't3');
    let estado, stale = false;
    if (dot.kind === 'won') estado = `Venda em ${fmt.dm(new Date(d.fechadoEm as number))}`;
    else if (dot.kind === 'lost') estado = 'Perdido';
    else { const dias = Math.max(0, Math.floor((st.tSim - (dot.em as number)) / DAY)); stale = dias >= 7; estado = `${ETAPA_NOME[dot.e as Etapa]} há ${dias} ${dias === 1 ? 'dia' : 'dias'}`; }
    t3.append(el('b', '', fmt.money(d.valor)), el('span', stale ? 'stale' : '', estado));
    tip.append(t1, t2, t3);
  }
  function posicionarTip(dot: Dot | null) {
    if (!dot || !dot.vis) { tip.hidden = true; return; }
    if (tip.hidden) return;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = dot.sx + 16; if (left + tw > st.W - 8) left = dot.sx - tw - 16;
    left = clamp(left, 8, Math.max(8, st.W - tw - 8));
    const top = clamp(dot.sy - th / 2, 8, Math.max(8, st.H - th - 8));
    tip.style.transform = `translate(${Math.round(left)}px,${Math.round(top)}px)`;
  }
  function mostrarTip(dot: Dot) { preencherTip(dot); tip.hidden = false; posicionarTip(dot); }
  function esconderTip() { if (!st.pin) tip.hidden = true; }
  function setHl(k: number | null, from: string | null) {
    if (st.hl === k) return;
    st.hl = k; st.hlFrom = from;
    $$('#stl li').forEach(li => li.classList.toggle('hl', k != null && li.dataset.k === RINGS[k].k));
    if (REDUCED) draw(performance.now(), 0);
  }
  function hoverAt(mx: number, my: number) {
    const k = rotuloEm(mx, my);
    if (k != null) { setHl(k, 'orbit'); cv.style.cursor = 'pointer'; st.hover = null; esconderTip(); return; }
    if (st.hlFrom === 'orbit') setHl(null, null);
    cv.style.cursor = '';
    const dot = pontoMaisProximo(mx, my);
    if (dot !== st.hover) { st.hover = dot; if (dot) mostrarTip(dot); else esconderTip(); }
    if (REDUCED) draw(performance.now(), 0);
  }
  function tapAt(mx: number, my: number) {
    const k = rotuloEm(mx, my);
    if (k != null) { setHl(st.hl === k ? null : k, 'orbit'); return; }
    const dot = pontoMaisProximo(mx, my);
    st.pin = dot; st.hover = null;
    if (dot) mostrarTip(dot); else tip.hidden = true;
    if (REDUCED) draw(performance.now(), 0);
  }
  cv.addEventListener('pointerdown', e => {
    st.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: st.yaw, elev: st.elevT, moved: false, lx: e.clientX, lt: performance.now() };
    st.lastInt = performance.now();
  }, { signal });
  cv.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    if (st.drag && st.drag.id === e.pointerId) {
      const dx = e.clientX - st.drag.x, dy = e.clientY - st.drag.y;
      if (!st.drag.moved && Math.abs(dx) + Math.abs(dy) > 5) { st.drag.moved = true; try { cv.setPointerCapture(e.pointerId); } catch { /* ok */ } cv.classList.add('drag'); }
      if (st.drag.moved) {
        const t = performance.now(), ddt = Math.max(8, t - st.drag.lt);
        st.yaw = st.drag.yaw + dx * .0065;
        if (e.pointerType === 'mouse') { st.elevT = clamp(st.drag.elev + dy * .004, .2, 1.05); st.elevSet = true; }
        st.yawV = clamp((e.clientX - st.drag.lx) * .0065 / (ddt / 1000), -5, 5);
        st.drag.lx = e.clientX; st.drag.lt = t; st.lastInt = t;
        st.hover = null; esconderTip();
        if (REDUCED) draw(t, 0);
      }
      return;
    }
    if (e.pointerType === 'mouse') hoverAt(mx, my);
  }, { signal });
  function soltar(e: PointerEvent) {
    if (!st.drag || st.drag.id !== e.pointerId) return;
    const moved = st.drag.moved; st.drag = null; cv.classList.remove('drag');
    if (!moved) { const r = cv.getBoundingClientRect(); tapAt(e.clientX - r.left, e.clientY - r.top); }
  }
  cv.addEventListener('pointerup', soltar, { signal });
  cv.addEventListener('pointercancel', () => { st.drag = null; cv.classList.remove('drag'); }, { signal });
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !st.drag) { st.hover = null; if (st.hlFrom === 'orbit') setHl(null, null); esconderTip(); } }, { signal });
  $('#btnReplay').addEventListener('click', () => {
    if (st.replay) st.replay.start = performance.now() - st.replay.dur;
    else { st.pin = null; tip.hidden = true; iniciarReplay(0); }
  }, { signal });
  if (REDUCED) $('#replay').hidden = true;

  return {
    resize, setData, draw, highlight: k => setHl(k == null ? null : IDX[k], k == null ? null : 'list'),
    replay: iniciarReplay, intro: iniciarIntro, el: stageEl, visible: true
  };
}
