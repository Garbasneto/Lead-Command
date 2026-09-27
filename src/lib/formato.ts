import { CONFIG } from './config';

/* ================= formatação ================= */
export const LOC = CONFIG.locale;
const NF = {
  int: new Intl.NumberFormat(LOC, { maximumFractionDigits: 0 }),
  d1: new Intl.NumberFormat(LOC, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  c0: new Intl.NumberFormat(LOC, { style: 'currency', currency: CONFIG.moeda, minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  c2: new Intl.NumberFormat(LOC, { style: 'currency', currency: CONFIG.moeda, minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  cK: new Intl.NumberFormat(LOC, { style: 'currency', currency: CONFIG.moeda, notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 }),
  p1: new Intl.NumberFormat(LOC, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  p0: new Intl.NumberFormat(LOC, { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  pS: new Intl.NumberFormat(LOC, { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 0, signDisplay: 'exceptZero' }),
  cp: new Intl.NumberFormat(LOC, { notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 })
};
export const ND = 'n/d';
export const fmt = {
  int: (v: number) => NF.int.format(Math.round(v)),
  money: (v: number) => NF.c0.format(v),
  money2: (v: number) => NF.c2.format(v),
  moneyK: (v: number) => NF.cK.format(v),
  pct: (v: number) => NF.p1.format(v),
  pct0: (v: number) => NF.p0.format(v),
  pctS: (v: number) => NF.pS.format(v),
  comp: (v: number) => NF.cp.format(v),
  x: (v: number) => NF.d1.format(v) + 'x',
  d1: (v: number) => NF.d1.format(v),
  dm: (d: Date) => d.toLocaleDateString(LOC, { day: '2-digit', month: '2-digit' }),
  hm: (d: Date) => d.toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit' }),
  wd: (d: Date) => d.toLocaleDateString(LOC, { weekday: 'short' }).replace('.', '')
};
