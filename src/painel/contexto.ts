import type { Visao } from '@/lib/metricas/computar';
import type { Campanha, Dados, Filtros } from '@/lib/tipos';
import type { Ambiente } from './ambiente';
import type { Barras } from './graficos/barras';
import type { Cpl } from './graficos/cpl';
import type { Diario } from './graficos/diario';
import type { Funil } from './graficos/funil';
import type { Gauge } from './graficos/gauge';
import type { Orbita } from './graficos/orbita';

/* Estado compartilhado do painel enquanto a tela está aberta. */
export interface Painel {
  amb: Ambiente;
  DATA: Dados;
  CAMP: Record<string, Campanha>;
  S: Filtros;
  VIEW: Visao;
  sparkVals: number[] | null;
  orbita: Orbita;
  diario: Diario;
  cplChart: Cpl;
  funil: Funil;
  gauge: Gauge;
  barSeg: Barras;
  barVis: Barras;
  barTp: Barras;
  atualizar(): void;
}
