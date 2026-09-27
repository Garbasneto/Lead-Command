import { OBJ } from '@/lib/etapas';
import type { Visao } from '@/lib/metricas/computar';
import type { Campanha, Dados, Filtros, Fonte } from '@/lib/tipos';
import { el } from './ambiente';
import type { Painel } from './contexto';

/* ================= estado dos filtros ================= */
const STORE = 'hub-lead-command:filtros:v2';

export function carregarFiltros(DATA: Dados, CAMP: Record<string, Campanha>): Filtros {
  const S: Filtros = { periodo: 30, fontes: { meta: true, google: true }, pausadas: false, sel: new Set(DATA.campanhas.filter(c => c.status === 'ativa').map(c => c.id)) };
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const o = JSON.parse(raw);
      if ([7, 14, 30, 90].includes(o.periodo)) S.periodo = o.periodo;
      if (o.fontes) S.fontes = { meta: o.fontes.meta !== false, google: o.fontes.google !== false };
      S.pausadas = !!o.pausadas;
      if (Array.isArray(o.sel)) { const s = o.sel.filter((id: string) => CAMP[id]); if (s.length) S.sel = new Set(s); }
    }
  } catch { /* sem armazenamento: segue com o padrão */ }
  return S;
}
export function salvar(S: Filtros) { try { localStorage.setItem(STORE, JSON.stringify({ periodo: S.periodo, fontes: S.fontes, pausadas: S.pausadas, sel: [...S.sel] })); } catch { /* ignora */ } }

/* ================= filtros ================= */
export function montarFiltros(P: Painel) {
  const { amb, S } = P, { $, $$, SRC, signal } = amb;
  let POP: HTMLElement | null = null;

  function opcao(role: string, checked: boolean, texto: string, act: string, cor?: string, sub?: string) {
    const b = el('button', 'opt'); b.type = 'button'; b.setAttribute('role', role); b.setAttribute('aria-checked', String(checked)); b.dataset.act = act;
    b.append(el('i', 'ck'));
    if (cor) { const d = el('i', 'od'); d.style.setProperty('--c', cor); b.append(d); }
    b.append(el('span', 'ot', texto));
    if (sub) b.append(el('span', 'os', sub));
    return b;
  }
  function renderPop(f: string) {
    const VIEW = P.VIEW;
    const pop = $(`.fp[data-f="${f}"] .pop`); pop.textContent = '';
    if (f === 'periodo') [7, 14, 30, 90].forEach(p => pop.append(opcao('menuitemradio', S.periodo === p, `Últimos ${p} dias`, String(p))));
    if (f === 'fontes') (['meta', 'google'] as Fonte[]).forEach(s => pop.append(opcao('menuitemcheckbox', S.fontes[s], SRC[s].nome, s, SRC[s].cor)));
    if (f === 'status') { pop.append(opcao('menuitemradio', !S.pausadas, 'Só campanhas ativas', 'ativas')); pop.append(opcao('menuitemradio', S.pausadas, 'Ativas e pausadas', 'todas')); }
    if (f === 'campanhas') {
      if (!VIEW.visiveis.length) pop.append(el('div', 'pop-note', 'Ligue ao menos uma fonte para ver as campanhas.'));
      VIEW.visiveis.forEach(c => pop.append(opcao('menuitemcheckbox', S.sel.has(c.id), c.nome, c.id, SRC[c.fonte].cor, `${OBJ[c.objetivo].curto} · ${c.status}`)));
      if (VIEW.visiveis.length) {
        const acts = el('div', 'pop-acts');
        const a = el('button', '', 'Todas'); a.type = 'button'; a.dataset.act = '*todas';
        const b = el('button', '', 'Só leads'); b.type = 'button'; b.dataset.act = '*leads';
        const c = el('button', '', 'Limpar'); c.type = 'button'; c.dataset.act = '*limpar';
        acts.append(a, b, c); pop.append(acts);
      }
    }
  }
  function abrirPop(fp: HTMLElement) {
    fecharPop(); POP = fp;
    fp.querySelector('.pill')!.setAttribute('aria-expanded', 'true');
    renderPop(fp.dataset.f as string);
    const pop = fp.querySelector<HTMLElement>('.pop')!; pop.style.left = ''; pop.hidden = false;
    const pr = pop.getBoundingClientRect(), lim = document.documentElement.clientWidth - 8;
    if (pr.right > lim && getComputedStyle(fp).position !== 'static') pop.style.left = Math.round(lim - pr.right) + 'px';
    const first = pop.querySelector<HTMLElement>('.opt[aria-checked="true"]') || pop.querySelector<HTMLElement>('.opt, button');
    if (first) first.focus();
  }
  function fecharPop() {
    if (!POP) return;
    POP.querySelector('.pill')!.setAttribute('aria-expanded', 'false');
    POP.querySelector<HTMLElement>('.pop')!.hidden = true; POP = null;
  }
  function acaoFiltro(f: string, act: string) {
    const VIEW = P.VIEW;
    if (f === 'periodo') { S.periodo = +act; fecharPop(); }
    else if (f === 'fontes') { S.fontes[act as Fonte] = !S.fontes[act as Fonte]; }
    else if (f === 'status') { S.pausadas = act === 'todas'; fecharPop(); }
    else if (f === 'campanhas') {
      if (act === '*todas') VIEW.visiveis.forEach(c => S.sel.add(c.id));
      else if (act === '*limpar') VIEW.visiveis.forEach(c => S.sel.delete(c.id));
      else if (act === '*leads') VIEW.visiveis.forEach(c => { if (c.objetivo === 'leads') S.sel.add(c.id); else S.sel.delete(c.id); });
      else if (S.sel.has(act)) S.sel.delete(act); else S.sel.add(act);
    }
    P.atualizar();
    if (POP && POP.dataset.f === f) { renderPop(f); const b = POP.querySelector<HTMLElement>(`[data-act="${CSS.escape(act)}"]`); if (b) b.focus(); }
  }
  $$('.fp').forEach(fp => {
    fp.querySelector('.pill')!.addEventListener('click', e => { e.stopPropagation(); if (POP === fp) fecharPop(); else abrirPop(fp); }, { signal });
    const pop = fp.querySelector<HTMLElement>('.pop')!;
    pop.addEventListener('click', e => { const b = (e.target as Element).closest<HTMLElement>('[data-act]'); if (!b) return; e.stopPropagation(); acaoFiltro(fp.dataset.f as string, b.dataset.act as string); }, { signal });
    pop.addEventListener('keydown', e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const items = Array.from(pop.querySelectorAll('button')), i = items.indexOf(document.activeElement as HTMLButtonElement);
      const n = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]; if (n) n.focus();
    }, { signal });
  });
  document.addEventListener('pointerdown', e => { if (POP && !POP.contains(e.target as Node)) fecharPop(); }, { signal });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && POP) { const b = POP.querySelector<HTMLElement>('.pill')!; fecharPop(); b.focus(); } }, { signal });
}

function textoFontes(P: Painel) { const on = (['meta', 'google'] as Fonte[]).filter(f => P.S.fontes[f]); return on.length === 2 ? 'Meta e Google' : on.length ? P.amb.SRC[on[0]].nome : 'Nenhuma'; }
export function renderPills(P: Painel, V: Visao) {
  const { $ } = P.amb, S = P.S;
  $('#pvPeriodo').textContent = `${S.periodo} dias`;
  $('#pvFontes').textContent = textoFontes(P);
  $('#pvStatus').textContent = S.pausadas ? 'Ativas e pausadas' : 'Só ativas';
  $('#pvCamp').textContent = `${V.sel.length} de ${V.visiveis.length}`;
}
