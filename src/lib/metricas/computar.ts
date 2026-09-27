import { ETAPA_NOME, ETAPAS_TODAS } from '../etapas';
import { fmt } from '../formato';
import type { Campanha, ChaveMetrica, Dados, Etapa, Filtros, Fonte, Negocio, Objetivo } from '../tipos';
import { DAY } from '../util';

/* ================= cálculo =================
   Um lugar só para as métricas do painel. As regras fixas estão no CLAUDE.md:
   - CPL usa só campanhas de lead (audiência nunca entra no CPL nem no funil de leads).
   - Retorno por coorte: receita dos leads criados no período ÷ todo o investimento selecionado.
   - Qualificado e proposta contam negócios que chegaram à etapa. Parado = 7+ dias na mesma etapa. */

export const chegou = (d: Negocio, e: Etapa) => d.hist.some(h => h.etapa === e);
export const CHAVES: ChaveMetrica[] = ['invest', 'impressoes', 'cliques', 'leads', 'visitas', 'thruplays'];

type Totais = Record<ChaveMetrica, number>;
export type TotaisPorFonte = Totais & Record<Fonte, Totais>;
interface Janela { a: number; b: number }

export interface DiaVisao {
  i: number; data: Date; hoje: boolean;
  leads: Record<Fonte, number>; investLead: number;
  cpl7: Record<Fonte, number | null>; cpl7Total: number | null;
  qual: number; vendas: number; receita: number; visitas: number; thruplays: number; seguidores: number;
}
export interface Evento { t: number; kind: string; cls: '' | 'win' | 'lost'; fonte: Fonte; msg: string }
type PorFonte = { total: number } & Record<Fonte, number>;
type EstadoEtapa = { n: number; valor: number; parados: number } & Record<Fonte, number>;

export type Visao = ReturnType<typeof computar>;

export function computar(DATA: Dados, S: Filtros) {
  const CAMP: Record<string, Campanha> = Object.fromEntries(DATA.campanhas.map(c => [c.id, c]));
  const N = DATA.datas.length, p = S.periodo;
  const win: Janela = { a: N - p, b: N - 1 };
  const winPrev: Janela | null = N - 2 * p >= 0 ? { a: N - 2 * p, b: N - p - 1 } : null;
  const visiveis = DATA.campanhas.filter(c => S.fontes[c.fonte] && (c.status === 'ativa' || S.pausadas));
  const sel = visiveis.filter(c => S.sel.has(c.id));
  const selLead = sel.filter(c => c.objetivo === 'leads');
  const selIds = new Set(sel.map(c => c.id));
  const fontesLead = new Set(selLead.map(c => c.fonte));

  const somar = (w: Janela, lista: Campanha[]): TotaisPorFonte => {
    const z = () => Object.fromEntries(CHAVES.map(k => [k, 0])) as Totais;
    const o: TotaisPorFonte = Object.assign(z(), { meta: z(), google: z() });
    for (const c of lista) for (let i = w.a; i <= w.b; i++) for (const k of CHAVES) { const v = c.dias[k][i]; o[k] += v; o[c.fonte][k] += v; }
    return o;
  };
  const T = somar(win, sel), TP = winPrev ? somar(winPrev, sel) : null;
  const TL = somar(win, selLead), TLP = winPrev ? somar(winPrev, selLead) : null;
  const cpl = TL.leads > 0 ? TL.invest / TL.leads : null;
  const cplPrev = TLP && TLP.leads > 0 ? TLP.invest / TLP.leads : null;

  const dias: DiaVisao[] = [];
  for (let i = win.a; i <= win.b; i++) {
    const d: DiaVisao = { i, data: DATA.datas[i], hoje: i === N - 1, leads: { meta: 0, google: 0 }, investLead: 0, cpl7: { meta: null, google: null }, cpl7Total: null, qual: 0, vendas: 0, receita: 0, visitas: 0, thruplays: 0, seguidores: DATA.seguidores[i] };
    for (const c of selLead) { d.leads[c.fonte] += c.dias.leads[i]; d.investLead += c.dias.invest[i]; }
    for (const c of sel) { d.visitas += c.dias.visitas[i]; d.thruplays += c.dias.thruplays[i]; }
    const inv = { meta: 0, google: 0 }, ld = { meta: 0, google: 0 };
    for (let k = Math.max(0, i - 6); k <= i; k++) for (const c of selLead) { inv[c.fonte] += c.dias.invest[k]; ld[c.fonte] += c.dias.leads[k]; }
    for (const f of ['meta', 'google'] as const) if (fontesLead.has(f) && ld[f] > 0) d.cpl7[f] = inv[f] / ld[f];
    const lt = ld.meta + ld.google;
    d.cpl7Total = lt > 0 ? (inv.meta + inv.google) / lt : null;
    dias.push(d);
  }

  // Pipedrive: negócios criados no período, vindos das campanhas selecionadas
  const t0 = DATA.datas[win.a].getTime();
  const coorte = DATA.deals.filter(d => selIds.has(d.campanhaId) && d.criadoEm >= t0);
  const z3 = (): PorFonte => ({ total: 0, meta: 0, google: 0 });
  const funil = { impressoes: TL.impressoes, cliques: TL.cliques, leads: TL.leads, qual: z3(), prop: z3(), vendas: z3() };
  const pipe = {} as Record<Etapa, EstadoEtapa>; for (const k of ETAPAS_TODAS) pipe[k] = { n: 0, valor: 0, meta: 0, google: 0, parados: 0 };
  let receita = 0, ciclo = 0, abertos = 0, valorAberto = 0, parados = 0;
  const diaDe = (t: number) => Math.floor((t - t0) / DAY);
  for (const d of coorte) {
    const hq = d.hist.find(h => h.etapa === 'qualificado');
    if (hq) { funil.qual.total++; funil.qual[d.fonte]++; const di = diaDe(hq.em); if (di >= 0 && di < dias.length) dias[di].qual++; }
    if (chegou(d, 'proposta')) { funil.prop.total++; funil.prop[d.fonte]++; }
    const k: Etapa = d.status === 'aberto' ? d.etapa : d.status;
    pipe[k].n++; pipe[k].valor += d.valor; pipe[k][d.fonte]++;
    if (d.status === 'ganho' && d.fechadoEm != null) {
      funil.vendas.total++; funil.vendas[d.fonte]++; receita += d.valor; ciclo += (d.fechadoEm - d.criadoEm) / DAY;
      const di = diaDe(d.fechadoEm); if (di >= 0 && di < dias.length) { dias[di].vendas++; dias[di].receita += d.valor; }
    }
    if (d.status === 'aberto') {
      abertos++; valorAberto += d.valor;
      if ((DATA.agora - d.hist[d.hist.length - 1].em) / DAY >= 7) { pipe[d.etapa].parados++; parados++; }
    }
  }
  const vendas = funil.vendas.total;
  const temLead = selLead.length > 0 && T.invest > 0;
  const roi = {
    receita, vendas, abertos, valorAberto, parados,
    roas: temLead ? receita / T.invest : null,
    roi: temLead ? (receita - T.invest) / T.invest : null,
    custoVenda: vendas > 0 ? T.invest / vendas : null,
    cpq: funil.qual.total > 0 ? TL.invest / funil.qual.total : null,
    ticket: vendas > 0 ? receita / vendas : null,
    ciclo: vendas > 0 ? ciclo / vendas : null,
    leadVenda: coorte.length > 0 ? vendas / coorte.length : null,
    pctAberto: coorte.length > 0 ? abertos / coorte.length : null
  };

  // audiência
  const somaSerie = (arr: number[], w: Janela | null) => { if (!w) return null; let s = 0; for (let i = w.a; i <= w.b; i++) s += arr[i]; return s; };
  const selTraf = sel.filter(c => c.objetivo === 'trafego'), selVid = sel.filter(c => c.objetivo === 'video');
  const AT = somar(win, selTraf), AV = somar(win, selVid);
  const aud = {
    seguidores: somaSerie(DATA.seguidores, win) as number, seguidoresPrev: somaSerie(DATA.seguidores, winPrev),
    visitas: T.visitas, visitasPrev: TP ? TP.visitas : null, investTrafego: AT.invest,
    thruplays: T.thruplays, thruplaysPrev: TP ? TP.thruplays : null, investVideo: AV.invest, imprVideo: AV.impressoes,
    invest: AT.invest + AV.invest, impressoes: AT.impressoes + AV.impressoes,
    temTrafego: selTraf.length > 0, temVideo: selVid.length > 0
  };
  const porObjetivo = (['leads', 'trafego', 'video'] as Objetivo[]).filter(o => sel.some(c => c.objetivo === o)).map(o => {
    const cs = sel.filter(c => c.objetivo === o), s = somar(win, cs);
    const res = o === 'leads' ? s.leads : o === 'trafego' ? s.visitas : s.thruplays;
    return { o, n: cs.length, invest: s.invest, res, custo: res > 0 ? s.invest / res : null };
  });

  // eventos do período, lidos do histórico dos negócios
  const eventos: Evento[] = [];
  for (const d of DATA.deals) {
    if (!selIds.has(d.campanhaId)) continue;
    const c = CAMP[d.campanhaId];
    for (const h of d.hist) {
      if (h.em < t0 || h.em > DATA.agora) continue;
      let kind: string, msg: string, cls: Evento['cls'] = '';
      switch (h.etapa) {
        case 'novo': kind = 'Lead'; msg = `Novo lead #${d.id} · ${c.nome}`; break;
        case 'ganho': kind = 'Venda'; cls = 'win'; msg = `#${d.id} fechou ${fmt.money(d.valor)} · ${c.nome}`; break;
        case 'perdido': kind = 'Perdido'; cls = 'lost'; msg = `#${d.id} perdido na etapa ${ETAPA_NOME[h.de as Etapa]}`; break;
        case 'proposta': kind = 'Proposta'; msg = `#${d.id} recebeu proposta de ${fmt.money(d.valor)}`; break;
        default: kind = ETAPA_NOME[h.etapa]; msg = `#${d.id} movido para ${ETAPA_NOME[h.etapa]}`;
      }
      eventos.push({ t: h.em, kind, cls, fonte: d.fonte, msg });
    }
  }
  for (const c of sel) {
    if (c.pausaEm) { const t = c.pausaEm.getTime(); if (t >= t0 && t <= DATA.agora) eventos.push({ t, kind: 'Campanha', cls: '', fonte: c.fonte, msg: `${c.nome} pausada` }); }
  }
  eventos.sort((a, b) => a.t - b.t);

  const cards = sel.map(c => {
    const s = Object.fromEntries(CHAVES.map(k => [k, 0])) as Totais;
    let ativo = 0; const serie: number[] = [];
    const chaveSerie: ChaveMetrica = c.objetivo === 'leads' ? 'leads' : c.objetivo === 'trafego' ? 'visitas' : 'thruplays';
    for (let i = win.a; i <= win.b; i++) {
      for (const k of CHAVES) s[k] += c.dias[k][i];
      ativo += c.ativoDia[i];
      serie.push(c.dias[chaveSerie][i]);
    }
    const cd = coorte.filter(d => d.campanhaId === c.id);
    const v = cd.filter(d => d.status === 'ganho');
    return { c, s, serie, orcPeriodo: c.orc * ativo, q: cd.filter(d => chegou(d, 'qualificado')).length, vendas: v.length, receita: v.reduce((a, d) => a + d.valor, 0) };
  });

  return { periodo: p, win, visiveis, sel, selLead, fontesLead, T, TP, TL, TLP, cpl, cplPrev, dias, funil, pipe, roi, aud, porObjetivo, eventos, cards, coorte, coorteN: coorte.length };
}

