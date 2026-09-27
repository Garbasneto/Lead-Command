import type { Etapa, EtapaAberta, Fonte, Objetivo } from './tipos';

/* Etapas do funil de demonstração. Com o Pipedrive conectado, virão do pipeline, nunca fixas no código. */
export const ETAPA_NOME: Record<Etapa, string> = { novo: 'Novo', contato: 'Contato', qualificado: 'Qualificado', proposta: 'Proposta', negociacao: 'Negociação', ganho: 'Ganho', perdido: 'Perdido' };
export const ETAPAS_ABERTAS: EtapaAberta[] = ['novo', 'contato', 'qualificado', 'proposta', 'negociacao'];
export const ETAPAS_TODAS: Etapa[] = [...ETAPAS_ABERTAS, 'ganho', 'perdido'];

export const FONTES: Fonte[] = ['meta', 'google'];

export const OBJ: Record<Objetivo, { nome: string; rotulo: string; curto: string; res: string; un: string }> = {
  leads: { nome: 'Leads', rotulo: 'Leads', curto: 'lead', res: 'leads', un: 'lead' },
  trafego: { nome: 'Tráfego para o perfil', rotulo: 'Tráfego', curto: 'perfil', res: 'visitas', un: 'visita' },
  video: { nome: 'Vídeo', rotulo: 'Vídeo', curto: 'vídeo', res: 'ThruPlays', un: 'ThruPlay' }
};
