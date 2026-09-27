import type { Fonte } from '@/lib/tipos';

/* Tudo o que o painel precisa do navegador, criado só quando a tela monta.
   Também guarda o que precisa ser desligado quando a tela sai (eventos, animações, timers). */

export interface Cores {
  hair: string; axis: string; ink: string; ink2: string; ink3: string;
  accent: string; accent2: string; meta: string; google: string; good: string; bad: string;
  st: string[]; surface: string; neutral: string;
}

export interface Ambiente {
  $: <T extends Element = HTMLElement>(s: string) => T;
  $$: <T extends Element = HTMLElement>(s: string) => T[];
  REDUCED: boolean;
  FINE: boolean;
  AUTOMATED: boolean;
  COL: Cores;
  SANS: string;
  MONO: string;
  SRC: Record<Fonte, { nome: string; curto: string; cor: string }>;
  /* Estado das animações de número, por elemento (substitui elm._tok e elm._v do protótipo). */
  contadores: WeakMap<Element, { tok: number; v: number | null }>;
  tokens: WeakMap<Element, number>;
  /* Encerramento: listeners com { signal } saem sozinhos; raf, timers e observers também. */
  signal: AbortSignal;
  vivo: () => boolean;
  raf: (cb: FrameRequestCallback) => number;
  timeout: (cb: () => void, ms: number) => void;
  interval: (cb: () => void, ms: number) => void;
  observar: <O extends { disconnect(): void }>(o: O) => O;
  encerrar: () => void;
}

export function criarAmbiente(root: HTMLElement): Ambiente {
  const $ = <T extends Element = HTMLElement>(s: string): T => {
    const e = root.querySelector<T>(s);
    if (!e) throw new Error(`Elemento não encontrado: ${s}`);
    return e;
  };
  const $$ = <T extends Element = HTMLElement>(s: string): T[] => Array.from(root.querySelectorAll<T>(s));

  const css = getComputedStyle(document.documentElement);
  const tok = (n: string, f: string) => css.getPropertyValue('--' + n).trim() || f;
  const COL: Cores = {
    hair: tok('hair', '#14222a'), axis: tok('axis', '#223440'),
    ink: tok('ink', '#e6f1f0'), ink2: tok('ink-2', '#9aafb0'), ink3: tok('ink-3', '#64797b'),
    accent: tok('accent', '#5eead4'), accent2: tok('accent-2', '#2dd4bf'),
    meta: tok('meta', '#19a898'), google: tok('google', '#c98500'),
    good: tok('good', '#5fd47a'), bad: tok('bad', '#ff5d73'),
    st: [1, 2, 3, 4, 5].map(i => tok('st' + i, '#2cbfae')),
    surface: '#0c1417', neutral: '#b9d7d2'
  };

  const ctl = new AbortController();
  let vivo = true;
  const rafs = new Set<number>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<ReturnType<typeof setInterval>>();
  const observers = new Set<{ disconnect(): void }>();

  return {
    $, $$,
    REDUCED: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    FINE: window.matchMedia('(hover: hover) and (pointer: fine)').matches,
    AUTOMATED: navigator.webdriver === true,
    COL,
    SANS: tok('sans', 'sans-serif'),
    MONO: tok('mono', 'monospace'),
    SRC: {
      meta: { nome: 'Meta Ads', curto: 'Meta', cor: COL.meta },
      google: { nome: 'Google Ads', curto: 'Google', cor: COL.google }
    },
    contadores: new WeakMap(),
    tokens: new WeakMap(),
    signal: ctl.signal,
    vivo: () => vivo,
    raf(cb) {
      if (!vivo) return 0;
      const id = requestAnimationFrame(t => { rafs.delete(id); if (vivo) cb(t); });
      rafs.add(id);
      return id;
    },
    timeout(cb, ms) { const id = setTimeout(() => { timers.delete(id); if (vivo) cb(); }, ms); timers.add(id); },
    interval(cb, ms) { intervals.add(setInterval(() => { if (vivo) cb(); }, ms)); },
    observar(o) { observers.add(o); return o; },
    encerrar() {
      vivo = false;
      ctl.abort();
      rafs.forEach(id => cancelAnimationFrame(id)); rafs.clear();
      timers.forEach(id => clearTimeout(id)); timers.clear();
      intervals.forEach(id => clearInterval(id)); intervals.clear();
      observers.forEach(o => o.disconnect()); observers.clear();
    }
  };
}

/* Componente de gráfico: o laço de animação chama draw; os observers chamam resize. */
export interface Componente {
  resize(): void;
  draw(now: number, dt?: number): void;
  replay?(): void;
  el: HTMLElement;
  visible: boolean;
  pend?: boolean;
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string | null): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e;
}
