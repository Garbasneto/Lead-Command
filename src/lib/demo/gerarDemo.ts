import { poisson, rngDe } from '../aleatorio';
import { clamp, DAY } from '../util';
import type { Campanha, ChaveMetrica, Dados, Etapa, Fonte, Negocio, Objetivo, PassoHistorico } from '../tipos';

/* ================= dados de demonstração =================
   Gerados no navegador, de forma determinística por data.
   Formato que o painel consome: ver lib/tipos.ts (o mesmo que os dados reais vão precisar ter). */

const inicioDoDia = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const somaDias = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const chaveDia = (d: Date) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();

/* Parâmetros de cada campanha de exemplo. Só existem na demonstração. */
interface DefDemo {
  id: string; fonte: Fonte; objetivo: Objetivo; nome: string; tipo: string; status: 'ativa' | 'pausada';
  orc: number; pausaHa?: number; cpm?: number; cpc?: number; ctr: number; cvr: number; tpr?: number; trend?: number;
  qual: number; ticket: [number, number];
}

const DEFS: DefDemo[] = [
  { id: 'm1', fonte: 'meta', objetivo: 'leads', nome: 'Leads · Arquitetos', tipo: 'Formulário instantâneo', status: 'ativa', orc: 110, cpm: 32, ctr: 0.012, cvr: 0.095, trend: 0.25, qual: 0.31, ticket: [2800, 6400] },
  { id: 'm2', fonte: 'meta', objetivo: 'leads', nome: 'Leads · Designers de interiores', tipo: 'Formulário instantâneo', status: 'ativa', orc: 90, cpm: 28, ctr: 0.0105, cvr: 0.085, trend: 0.1, qual: 0.27, ticket: [2200, 5200] },
  { id: 'm3', fonte: 'meta', objetivo: 'trafego', nome: 'Tráfego · Visitas ao perfil', tipo: 'Tráfego para o Instagram', status: 'ativa', orc: 35, cpm: 11, ctr: 0.018, cvr: 0, qual: 0, ticket: [0, 0] },
  { id: 'm5', fonte: 'meta', objetivo: 'video', nome: 'Vídeo · Reels de cases', tipo: 'Reproduções de vídeo', status: 'ativa', orc: 42, cpm: 8.5, ctr: 0.005, tpr: 0.16, cvr: 0, qual: 0, ticket: [0, 0] },
  { id: 'm4', fonte: 'meta', objetivo: 'leads', nome: 'Remarketing · Engajados 30 dias', tipo: 'Formulário instantâneo', status: 'pausada', pausaHa: 27, orc: 40, cpm: 44, ctr: 0.016, cvr: 0.12, qual: 0.36, ticket: [2600, 6000] },
  { id: 'g1', fonte: 'google', objetivo: 'leads', nome: 'Pesquisa · Marketing para arquitetos', tipo: 'Rede de Pesquisa', status: 'ativa', orc: 85, cpc: 3.9, ctr: 0.064, cvr: 0.072, qual: 0.44, ticket: [3000, 7200] },
  { id: 'g2', fonte: 'google', objetivo: 'leads', nome: 'Performance Max · Leads', tipo: 'Performance Max', status: 'pausada', pausaHa: 41, orc: 70, cpm: 17, ctr: 0.009, cvr: 0.052, qual: 0.3, ticket: [2400, 5600] }
];

function criarDeal(c: DefDemo, criado: number, dia: number, chave: string, agora: number): Negocio {
  const r = rngDe('deal|' + chave);
  const u: number[] = []; for (let k = 0; k < 12; k++) u.push(r());
  const valor = Math.round((c.ticket[0] + u[0] * (c.ticket[1] - c.ticket[0])) / 100) * 100;
  const passos: [Etapa, number, number, number][] = [
    ['contato', c.fonte === 'google' ? 0.9 : 0.86, 0.05, 1.6],
    ['qualificado', c.qual, 1, 6],
    ['proposta', 0.55, 1, 5],
    ['negociacao', 0.6, 2, 7],
    ['ganho', 0.5, 2, 9]
  ];
  let t = criado, etapa: Etapa = 'novo', status: Negocio['status'] = 'aberto', fechadoEm: number | null = null;
  const hist: PassoHistorico[] = [{ etapa: 'novo', em: t }];
  for (let s = 0; s < passos.length; s++) {
    const [prox, p, dmin, dmax] = passos[s];
    const dt = (dmin + u[1 + s * 2] * (dmax - dmin)) * DAY;
    if (u[2 + s * 2] < p) {
      if (t + dt > agora) break;
      t += dt; etapa = prox; hist.push({ etapa: prox, em: t });
      if (prox === 'ganho') { status = 'ganho'; fechadoEm = t; }
    } else {
      const tp = t + dt * 1.3;
      if (tp <= agora) { status = 'perdido'; fechadoEm = tp; hist.push({ etapa: 'perdido', em: tp, de: etapa }); }
      break;
    }
  }
  return { id: 0, campanhaId: c.id, fonte: c.fonte, valor, criadoEm: criado, dia, etapa, status, fechadoEm, hist };
}

const CHAVES: ChaveMetrica[] = ['invest', 'impressoes', 'cliques', 'leads', 'visitas', 'thruplays'];

export function gerarDemo(agoraDate: Date): Dados {
  const N = 90;
  const agora = agoraDate.getTime();
  const hoje = inicioDoDia(agoraDate);
  const datas = Array.from({ length: N }, (_, i) => somaDias(hoje, i - (N - 1)));
  const horasHoje = (agora - hoje.getTime()) / 3600000;
  const fracHoje = clamp((horasHoje - 7.5) / 16, 0, 1);
  const campanhas: Campanha[] = [], deals: Negocio[] = [];
  for (const def of DEFS) {
    const pausaDia = def.pausaHa != null ? N - def.pausaHa : null;
    const c: Campanha = {
      id: def.id, fonte: def.fonte, objetivo: def.objetivo, nome: def.nome, tipo: def.tipo, status: def.status, orc: def.orc,
      pausaEm: pausaDia != null ? new Date(datas[pausaDia].getTime() + 10.5 * 3600000) : null,
      dias: Object.fromEntries(CHAVES.map(k => [k, new Array(N).fill(0)])) as Campanha['dias'],
      ativoDia: new Array(N).fill(0)
    };
    for (let i = 0; i < N; i++) {
      if (pausaDia != null && i >= pausaDia) continue;
      const frac = i === N - 1 ? fracHoje : 1;
      c.ativoDia[i] = frac;
      if (frac <= 0) continue;
      const r = rngDe(c.id + '|' + chaveDia(datas[i]));
      const dow = datas[i].getDay();
      const fds = dow === 0 || dow === 6;
      const prog = i / (N - 1);
      const invest = Math.round(def.orc * (0.9 + r() * 0.14) * (fds ? 0.96 : 1) * frac * 100) / 100;
      let impr, cliq;
      if (def.cpc) {
        const cpc = def.cpc * (0.85 + r() * 0.3);
        cliq = Math.round(invest / cpc);
        const ctr = def.ctr * (0.85 + r() * 0.3);
        impr = Math.round(cliq / ctr);
      } else {
        const cpm = (def.cpm ?? 0) * (0.85 + r() * 0.3);
        impr = Math.round(invest / cpm * 1000);
        const ctr = def.ctr * (0.85 + r() * 0.3) * (1 + (def.trend || 0) * prog);
        cliq = Math.round(impr * ctr);
      }
      const leads = def.cvr > 0 ? poisson(cliq * def.cvr * (fds ? 0.78 : 1), r) : 0;
      c.dias.invest[i] = invest; c.dias.impressoes[i] = impr; c.dias.cliques[i] = cliq; c.dias.leads[i] = leads;
      if (c.objetivo === 'trafego') c.dias.visitas[i] = cliq;
      if (def.tpr) c.dias.thruplays[i] = Math.round(impr * def.tpr * (0.85 + r() * 0.3));
      const maxH = i === N - 1 ? clamp(horasHoje, 7.5, 23.5) : 23.5;
      for (let j = 0; j < leads; j++) {
        const h = 7.5 + r() * (maxH - 7.5);
        deals.push(criarDeal(def, datas[i].getTime() + h * 3600000, i, c.id + '|' + chaveDia(datas[i]) + '|' + j, agora));
      }
    }
    campanhas.push(c);
  }
  const seguidores = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    const frac = i === N - 1 ? fracHoje : 1;
    if (frac <= 0) continue;
    const r = rngDe('ig|' + chaveDia(datas[i]));
    const dow = datas[i].getDay(), fds = dow === 0 || dow === 6;
    let vis = 0, tp = 0; for (const c of campanhas) { vis += c.dias.visitas[i]; tp += c.dias.thruplays[i]; }
    seguidores[i] = poisson(4.2 * (fds ? 1.15 : 1) * frac + vis * 0.03 + tp * 0.0045, r);
  }
  deals.sort((a, b) => a.criadoEm - b.criadoEm);
  deals.forEach((d, k) => { d.id = 4100 + k; });
  return { datas, agora, fracHoje, campanhas, deals, seguidores };
}
