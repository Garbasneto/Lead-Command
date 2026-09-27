/* Formato que o painel consome. Hoje vem dos dados de demonstração (lib/demo);
   os dados reais (Meta, Google, Pipedrive, Instagram) vão precisar chegar neste mesmo formato. */

export type Fonte = 'meta' | 'google';
export type Objetivo = 'leads' | 'trafego' | 'video';
export type EtapaAberta = 'novo' | 'contato' | 'qualificado' | 'proposta' | 'negociacao';
export type Etapa = EtapaAberta | 'ganho' | 'perdido';
export type ChaveMetrica = 'invest' | 'impressoes' | 'cliques' | 'leads' | 'visitas' | 'thruplays';

/* Valores por dia, alinhados com Dados.datas. */
export type SerieDiaria = Record<ChaveMetrica, number[]>;

export interface Campanha {
  id: string;
  fonte: Fonte;
  objetivo: Objetivo;
  nome: string;
  tipo: string;
  status: 'ativa' | 'pausada';
  orc: number; // orçamento por dia
  pausaEm: Date | null;
  dias: SerieDiaria;
  ativoDia: number[]; // fração de cada dia em que a campanha rodou (hoje é parcial)
}

export interface PassoHistorico {
  etapa: Etapa;
  em: number;
  de?: Etapa; // só em 'perdido': a etapa em que o negócio estava
}

/* Negócio do Pipedrive ligado à campanha de origem. */
export interface Negocio {
  id: number;
  campanhaId: string;
  fonte: Fonte;
  valor: number;
  criadoEm: number;
  dia: number;
  etapa: Etapa;
  status: 'aberto' | 'ganho' | 'perdido';
  fechadoEm: number | null;
  hist: PassoHistorico[];
}

export interface Dados {
  datas: Date[];
  agora: number;
  fracHoje: number;
  campanhas: Campanha[];
  deals: Negocio[];
  seguidores: number[]; // seguidores novos por dia na conta do Instagram (orgânico e pago juntos)
}

export interface Filtros {
  periodo: number;
  fontes: Record<Fonte, boolean>;
  pausadas: boolean;
  sel: Set<string>;
}
