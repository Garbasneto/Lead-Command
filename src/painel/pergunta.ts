import { CONFIG } from '@/lib/config';
import { ETAPAS_ABERTAS, OBJ } from '@/lib/etapas';
import type { Fonte } from '@/lib/tipos';
import type { Painel } from './contexto';

/* ================= pergunte ao painel =================
   No protótipo, a pergunta usava o Claude do próprio navegador (window.claude), que só existe
   quando o arquivo é aberto dentro do Claude. Aqui ele não existe, então o campo fica escondido,
   igual ao protótipo aberto direto no navegador. Na Fase 2 isso vira uma rota no servidor
   (API do Claude pelo SDK oficial, com as consultas ao banco como ferramentas). */

interface RespostaSample { text: string; truncated?: boolean; modelTierApplied?: string }
type Sample = (prompt: string, opts: { signal: AbortSignal; modelTier: string; onText: (p: { text: string }) => void }) => Promise<RespostaSample>;
declare global {
  interface Window { claude?: { use?: (cap: string) => Promise<Sample | null> } }
}

const r2 = (v: number | null | undefined) => (v == null || !isFinite(v) ? null : Math.round(v * 100) / 100);

function montarPrompt(P: Painel, q: string) {
  const V = P.VIEW, S = P.S, R = V.roi, A = V.aud;
  const fonte = (f: Fonte) => ({ investimento: r2(V.TL[f].invest), impressoes: V.TL[f].impressoes, cliques: V.TL[f].cliques, leads: V.TL[f].leads, cpl: r2(V.TL[f].leads ? V.TL[f].invest / V.TL[f].leads : null), ctr: r2(V.TL[f].impressoes ? V.TL[f].cliques / V.TL[f].impressoes : null) });
  const dados = {
    modo: 'demonstração: números de exemplo, não são dados reais da agência',
    moeda: CONFIG.moeda, periodo_dias: V.periodo,
    filtros: { fontes: (['meta', 'google'] as Fonte[]).filter(f => S.fontes[f]), inclui_pausadas: S.pausadas, campanhas_selecionadas: V.sel.map(c => `${c.nome} (${OBJ[c.objetivo].nome})`) },
    investimento_total: r2(V.T.invest),
    por_objetivo: V.porObjetivo.map(o => ({ objetivo: OBJ[o.o].nome, campanhas: o.n, investimento: r2(o.invest), resultado: o.res, unidade: OBJ[o.o].res, custo_por_resultado: r2(o.custo) })),
    campanhas_de_lead: { investimento: r2(V.TL.invest), leads: V.TL.leads, cpl: r2(V.cpl), cpl_periodo_anterior: r2(V.cplPrev), leads_periodo_anterior: V.TLP ? V.TLP.leads : null, qualificados: V.funil.qual.total, propostas: V.funil.prop.total, vendas: R.vendas, receita: r2(R.receita), custo_por_qualificado: r2(R.cpq), ticket_medio: r2(R.ticket), ciclo_medio_dias: r2(R.ciclo), leads_ainda_em_aberto: r2(R.pctAberto), por_fonte: { meta: V.fontesLead.has('meta') ? fonte('meta') : null, google: V.fontesLead.has('google') ? fonte('google') : null } },
    retorno_sobre_todo_investimento: { roas: r2(R.roas), roi: r2(R.roi), custo_por_venda: r2(R.custoVenda) },
    audiencia: { seguidores_novos_conta_instagram: A.seguidores, seguidores_periodo_anterior: A.seguidoresPrev, observacao_seguidores: 'somam orgânico e pago, não são atribuídos a campanha', visitas_ao_perfil: A.visitas, custo_por_visita: r2(A.visitas ? A.investTrafego / A.visitas : null), thruplays: A.thruplays, custo_por_thruplay: A.thruplays ? Math.round(A.investVideo / A.thruplays * 1000) / 1000 : null, investimento: r2(A.invest) },
    campanhas: V.cards.map(cd => ({ nome: cd.c.nome, fonte: cd.c.fonte, objetivo: OBJ[cd.c.objetivo].nome, status: cd.c.status, investimento: r2(cd.s.invest), impressoes: cd.s.impressoes, cliques: cd.s.cliques, leads: cd.s.leads, visitas_ao_perfil: cd.s.visitas, thruplays: cd.s.thruplays, qualificados: cd.q, vendas: cd.vendas, receita: r2(cd.receita), ritmo_orcamento: r2(cd.orcPeriodo ? cd.s.invest / cd.orcPeriodo : null) })),
    pipeline_aberto: Object.fromEntries(ETAPAS_ABERTAS.map(k => [k, { negocios: V.pipe[k].n, valor: r2(V.pipe[k].valor), parados_7_dias: V.pipe[k].parados }])),
    perdidos: V.pipe.perdido.n
  };
  return [
    'Você é o analista de performance da Hub Performance, agência de tráfego pago para arquitetos e designers de interiores.',
    'Responda em português do Brasil, em tom direto e prático, com no máximo 180 palavras. Vá direto à conclusão e depois mostre os números que a sustentam.',
    'Use somente os números do JSON abaixo. Não invente dados nem benchmarks de mercado. Se a pergunta pedir algo que não está nos dados, diga isso. Se a amostra for pequena demais para concluir, diga isso também.',
    'Campanhas de audiência (tráfego para o perfil e vídeo) não geram leads diretamente: avalie pelo custo por resultado delas. Seguidores novos são da conta inteira e não medem uma campanha sozinha.',
    'Não use travessão. Se fizer lista, no máximo 4 itens curtos. Valores monetários na moeda indicada.',
    'Os dados são de demonstração; mencione isso só se fizer diferença para a resposta.',
    '',
    'Dados do painel:',
    JSON.stringify(dados),
    '',
    'Pergunta: ' + q
  ].join('\n');
}
const ERROS_OCULTAR = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'];
const ERROS_TEXTO: Record<string, string> = {
  rate_limited: 'Muitas perguntas seguidas. Espere um pouco e tente de novo.',
  session_expired: 'Sua sessão expirou. Entre de novo no Claude e tente outra vez.',
  refused: 'O Claude não respondeu essa pergunta. Tente perguntar de outro jeito.',
  empty_completion: 'Veio uma resposta vazia. Tente perguntar de outro jeito.',
  prompt_too_large: 'Dados demais para uma pergunta. Reduza o período ou as campanhas.',
  cancelled: 'Resposta interrompida.'
};

export function montarPergunta(P: Painel) {
  const { amb } = P, { $, signal } = amb;
  let SAMPLE: Sample | null = null, askCtl: AbortController | null = null;

  async function perguntar(q: string) {
    q = (q || '').trim();
    if (!SAMPLE || !q) return;
    if (askCtl) askCtl.abort();
    const ctl = new AbortController(); askCtl = ctl;
    const ans = $('#ans'), txt = $('#ansText'), note = $('#ansNote'), stop = $('#ansStop'), send = $<HTMLButtonElement>('#askSend');
    ans.hidden = false; $('#ansQ').textContent = q; txt.textContent = 'Analisando os números da tela, pode levar até um minuto'; txt.classList.add('thinking'); note.textContent = ''; stop.hidden = false; send.disabled = true;
    try {
      const res = await SAMPLE(montarPrompt(P, q), { signal: ctl.signal, modelTier: 'complex', onText: ({ text }) => { if (askCtl !== ctl) return; txt.classList.remove('thinking'); txt.textContent = text; } });
      if (askCtl === ctl) {
        txt.classList.remove('thinking'); txt.textContent = res.text;
        const notas = [];
        if (res.truncated) notas.push('A resposta foi cortada. Tente uma pergunta mais específica.');
        if (res.modelTierApplied && res.modelTierApplied !== 'complex') notas.push('Seu plano respondeu com um modelo mais leve que o mais avançado.');
        note.textContent = notas.join(' ');
      }
    } catch (err) {
      const e = err as { code?: string; text?: string } | null;
      if (askCtl !== ctl && e && e.code === 'cancelled') return;
      const code = e && e.code;
      txt.classList.remove('thinking');
      if (code && ERROS_OCULTAR.includes(code)) { SAMPLE = null; $('#ask').hidden = true; P.orbita.resize(); return; }
      txt.textContent = code === 'refused' ? '' : (e && e.text) || '';
      note.textContent = (code && ERROS_TEXTO[code]) || 'Não consegui responder agora. Tente de novo em instantes.';
    } finally {
      if (askCtl === ctl) { askCtl = null; stop.hidden = true; send.disabled = false; }
    }
  }
  $('#askForm').addEventListener('submit', e => { e.preventDefault(); perguntar($<HTMLInputElement>('#askInput').value); }, { signal });
  $('#sugs').addEventListener('click', e => { const b = (e.target as Element).closest('button'); if (!b) return; $<HTMLInputElement>('#askInput').value = b.textContent || ''; perguntar(b.textContent || ''); }, { signal });
  $('#ansStop').addEventListener('click', () => { if (askCtl) askCtl.abort(); }, { signal });
  $('#ansClose').addEventListener('click', () => { if (askCtl) askCtl.abort(); $('#ans').hidden = true; }, { signal });
  signal.addEventListener('abort', () => { if (askCtl) askCtl.abort(); });
  (async () => {
    try {
      if (!window.claude || typeof window.claude.use !== 'function') return;
      const s = await window.claude.use('sample');
      if (!s || !amb.vivo()) return;
      SAMPLE = s; $('#ask').hidden = false;
      amb.raf(() => P.orbita.resize());
    } catch { /* sem acesso ao Claude nesta visualização */ }
  })();
}
