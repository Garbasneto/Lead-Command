import { ETAPA_NOME } from '@/lib/etapas';
import { fmt } from '@/lib/formato';
import type { Campanha, Etapa, EtapaAberta, Negocio } from '@/lib/tipos';
import { DAY } from '@/lib/util';
import { el, type Ambiente } from '../ambiente';

/* Partes comuns à órbita em WebGL (orbitaGL.ts) e à versão em Canvas 2D (orbita.ts, plano B). */

export const RINGS: { k: EtapaAberta; r: number }[] = [{ k: 'novo', r: 9.5 }, { k: 'contato', r: 7.95 }, { k: 'qualificado', r: 6.45 }, { k: 'proposta', r: 5.0 }, { k: 'negociacao', r: 3.6 }];
export const IDX: Record<string, number> = { novo: 0, contato: 1, qualificado: 2, proposta: 3, negociacao: 4 };
export const RB = 10.7, RCORE = 1.12, D0 = 30;

export type Tipo = 'pre' | 'open' | 'won' | 'lost';
export interface DotBase {
  d: Negocio; jit: number; rr: number; r: number; a: number; kind: Tipo; gone: boolean;
  e: Etapa | undefined; em: number | undefined;
}
export interface Alvo { kind: Tipo; r: number; a: number; e?: Etapa; em?: number; k?: number }

/* Onde o negócio deve estar no instante t: fora da órbita antes de existir, no anel da etapa aberta,
   no núcleo quando ganho, e se afastando quando perdido. */
export function alvo(dot: DotBase, t: number, rPre: number): Alvo {
  const d = dot.d;
  if (dot.gone) return { kind: dot.kind, r: dot.r, a: 0, e: dot.e, em: dot.em };
  if (t < d.criadoEm) return { kind: 'pre', r: rPre, a: 0 };
  let e: Etapa = 'novo', em = d.criadoEm;
  for (const h of d.hist) { if (h.em <= t) { e = h.etapa; em = h.em; } else break; }
  if (e === 'ganho') return { kind: 'won', r: dot.rr, a: 1, e, em };
  if (e === 'perdido') return { kind: 'lost', r: RB + 1.8, a: 0, e, em };
  return { kind: 'open', k: IDX[e], r: RINGS[IDX[e]].r + dot.jit, a: 1, e, em };
}

export function preencherTip(amb: Ambiente, tip: HTMLElement, dot: DotBase, CAMP: Record<string, Campanha>, tSim: number) {
  const { SRC } = amb, d = dot.d, c = CAMP[d.campanhaId];
  tip.textContent = '';
  const t1 = el('div', 't1'); const sw = el('i'); sw.style.setProperty('--c', SRC[d.fonte].cor); t1.append(sw, document.createTextNode(`#${d.id} · ${SRC[d.fonte].nome}`));
  const t2 = el('div', 't2', c.nome);
  const t3 = el('div', 't3');
  let estado, stale = false;
  if (dot.kind === 'won') estado = `Venda em ${fmt.dm(new Date(d.fechadoEm as number))}`;
  else if (dot.kind === 'lost') estado = 'Perdido';
  else { const dias = Math.max(0, Math.floor((tSim - (dot.em as number)) / DAY)); stale = dias >= 7; estado = `${ETAPA_NOME[dot.e as Etapa]} há ${dias} ${dias === 1 ? 'dia' : 'dias'}`; }
  t3.append(el('b', '', fmt.money(d.valor)), el('span', stale ? 'stale' : '', estado));
  tip.append(t1, t2, t3);
}
