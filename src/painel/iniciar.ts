import { gerarDemo } from '@/lib/demo/gerarDemo';
import { LOC } from '@/lib/formato';
import { computar, type Visao } from '@/lib/metricas/computar';
import type { Campanha } from '@/lib/tipos';
import { clamp } from '@/lib/util';
import { criarAmbiente, type Componente } from './ambiente';
import type { Painel } from './contexto';
import { montarFiltros, carregarFiltros, renderPills, salvar } from './filtros';
import { criarBarras } from './graficos/barras';
import { criarCpl } from './graficos/cpl';
import { criarDiario } from './graficos/diario';
import { criarFunil } from './graficos/funil';
import { criarGauge } from './graficos/gauge';
import { criarOrbita } from './graficos/orbita';
import { montarPergunta } from './pergunta';
import {
  ajustarColunasCamps, desenharSparkHero, renderAudiencia, renderCamps, renderEtapas, renderFeed,
  renderKPIs, renderObjetivos, renderRoi, renderTabela, renderTabelaAud, spot
} from './render';

/* ================= orquestração =================
   Liga o painel à marcação da CentralDeComando. Devolve a função que desliga tudo
   (eventos, animações, timers, observers) quando a tela sai. */
export function iniciarPainel(root: HTMLElement): () => void {
  const amb = criarAmbiente(root);
  const { $, $$, REDUCED, signal } = amb;

  const DATA = gerarDemo(new Date());
  const CAMP: Record<string, Campanha> = Object.fromEntries(DATA.campanhas.map(c => [c.id, c]));
  const S = carregarFiltros(DATA, CAMP);

  const orbita = criarOrbita(amb, DATA, CAMP), diario = criarDiario(amb), cplChart = criarCpl(amb), funil = criarFunil(amb), gauge = criarGauge(amb);
  const barSeg = criarBarras(amb, '#mSegWrap', '#mSeg', '#mSegTip', amb.COL.neutral, 'seguidores novos');
  const barVis = criarBarras(amb, '#mVisWrap', '#mVis', '#mVisTip', amb.COL.meta, 'visitas ao perfil');
  const barTp = criarBarras(amb, '#mTpWrap', '#mTp', '#mTpTip', amb.COL.meta, 'ThruPlays');
  const comps: Componente[] = [orbita, diario, cplChart, funil, gauge, barSeg, barVis, barTp];

  const P: Painel = {
    amb, DATA, CAMP, S, VIEW: null as unknown as Visao, sparkVals: null,
    orbita, diario, cplChart, funil, gauge, barSeg, barVis, barTp,
    atualizar
  };

  function aplicar(V: Visao, opts?: { anim?: boolean; snap?: boolean; intro?: boolean }) {
    const o = opts || {}, anim = o.anim !== false;
    P.VIEW = V;
    renderPills(P, V);
    $('#lgM').hidden = !V.fontesLead.has('meta'); $('#lgG').hidden = !V.fontesLead.has('google');
    renderKPIs(P, V, anim);
    funil.setData(V);
    orbita.setData(V, { snap: o.snap });
    diario.setData(V, o.intro);
    cplChart.setData(V);
    renderRoi(P, V, anim);
    renderEtapas(P, V);
    renderAudiencia(P, V, anim);
    renderObjetivos(P, V);
    renderCamps(P, V, anim);
    renderFeed(P, V, anim);
    if (!$('#dTable').hidden) renderTabela(P, V);
    if (REDUCED) amb.raf(desenharTudo); else finalizarOcultos();
  }
  function finalizar(c: Componente) { c.draw(performance.now() + 60000, 0); c.pend = true; }
  function finalizarOcultos() { for (const c of comps) if (c !== orbita && !c.visible) finalizar(c); }
  function desenharTudo() { const now = performance.now() + 60000; comps.forEach(c => c.draw(now, 0)); }
  function atualizar() {
    salvar(S);
    aplicar(computar(DATA, S), { anim: true });
    if (!REDUCED) $$('.col .card:not(.orbit-card), .aud').forEach(c => { c.classList.remove('recal'); void c.offsetWidth; c.classList.add('recal'); });
  }

  $('#tblBtn').addEventListener('click', () => {
    const btn = $('#tblBtn'), on = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(on));
    $('#dWrap').hidden = on; $('#dTable').hidden = !on;
    if (on) renderTabela(P, P.VIEW); else amb.raf(() => { diario.resize(); if (REDUCED) desenharTudo(); });
  }, { signal });
  $('#audTblBtn').addEventListener('click', () => {
    const btn = $('#audTblBtn'), on = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(on));
    $('#audCharts').hidden = on; $('#audTable').hidden = !on;
    if (on) renderTabelaAud(P, P.VIEW); else amb.raf(() => { [barSeg, barVis, barTp].forEach(c => { c.resize(); c.replay(); }); if (REDUCED) desenharTudo(); });
  }, { signal });
  $$('.col .card.fx').forEach(c => spot(amb, c, signal));

  function relogio() {
    const d = new Date();
    $('#clock').textContent = d.toLocaleTimeString(LOC, { hour12: false });
    $('#date').textContent = d.toLocaleDateString(LOC, { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '');
  }
  relogio(); amb.interval(relogio, 1000);

  montarFiltros(P);
  montarPergunta(P);
  comps.forEach(c => c.resize());
  /* A classe 'enter' é posta no <html> por um script no <head> (app/layout.tsx), antes da primeira pintura,
     só no primeiro carregamento e só sem "reduzir movimento" (e fora de navegador automatizado). */
  const html = document.documentElement;
  const primeira = html.classList.contains('enter');
  aplicar(computar(DATA, S), { anim: primeira, intro: true, snap: !primeira });
  if (primeira) {
    orbita.intro();
    orbita.replay(1250);
    amb.timeout(() => html.classList.remove('enter'), 2400);
  }

  const ro = amb.observar(new ResizeObserver(entries => {
    for (const en of entries) {
      if ((en.target as HTMLElement).id === 'camps') { ajustarColunasCamps(P); continue; }
      if ((en.target as HTMLElement).id === 'kSparkWrap') { desenharSparkHero(P, false); continue; }
      const c = comps.find(x => x.el === en.target);
      if (c) { c.resize(); if (!c.visible && !REDUCED) c.draw(performance.now() + 60000, 0); }
    }
    if (REDUCED) desenharTudo();
  }));
  comps.forEach(c => ro.observe(c.el));
  ro.observe($('#camps')); ro.observe($('#kSparkWrap'));
  if ('IntersectionObserver' in window) {
    const io = amb.observar(new IntersectionObserver(es => es.forEach(en => {
      const c = comps.find(x => x.el === en.target);
      if (!c || c.visible === en.isIntersecting) return;
      c.visible = en.isIntersecting;
      if (REDUCED || c === orbita) return;
      if (!c.visible) finalizar(c);
      else if (c.pend && c.replay) { c.pend = false; c.replay(); }
    })));
    comps.forEach(c => io.observe(c.el));
  }

  let last = performance.now(), raf = 0;
  function frame(now: number) {
    const dt = clamp((now - last) / 1000, 0, .05); last = now;
    for (const c of comps) if (c.visible) c.draw(now, dt);
    raf = amb.raf(frame);
  }
  if (REDUCED) { if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (amb.vivo()) desenharTudo(); }); desenharTudo(); }
  else {
    raf = amb.raf(frame);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else { last = performance.now(); raf = amb.raf(frame); }
    }, { signal });
  }

  return () => amb.encerrar();
}
