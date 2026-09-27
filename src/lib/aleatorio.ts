/* Números pseudoaleatórios determinísticos: a mesma chave gera sempre a mesma sequência.
   Usados pelos dados de demonstração e pela posição visual dos pontos da órbita. */
export function hash(s: string) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function mulberry(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const rngDe = (chave: string) => mulberry(hash(chave));
export function poisson(l: number, r: () => number) { if (!(l > 0)) return 0; const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= r(); } while (p > L && k < 400); return k - 1; }
