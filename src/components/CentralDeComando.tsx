'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { iniciarPainel } from '@/painel/iniciar';

/* Variáveis CSS em linha, como no protótipo (style="--i:0"). */
const v = (vars: Record<string, string>) => vars as CSSProperties;

/* Marcação da Central de Comando, portada do protótipo sem mudanças visuais.
   Os números, gráficos e listas são preenchidos por src/painel/iniciar.ts depois que a tela monta. */
export default function CentralDeComando() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    return iniciarPainel(ref.current);
  }, []);

  return (
    <>
      <div className="texture" aria-hidden="true"></div>
      <div className="app" id="app" ref={ref}>
        <header className="topbar pa" style={v({ '--i': '0' })}>
          <div className="brand">
            <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
              <circle cx="16" cy="16" r="4.2" fill="#5eead4" />
              <circle cx="16" cy="16" r="9.5" fill="none" stroke="#5eead4" strokeOpacity=".35" strokeWidth="1" />
              <ellipse cx="16" cy="16" rx="14" ry="5.2" fill="none" stroke="#5eead4" strokeOpacity=".7" strokeWidth="1.1" transform="rotate(-22 16 16)" />
              <g className="mdot"><circle cx="30" cy="16" r="1.8" fill="#c98500" /></g>
            </svg>
            <div><div className="b1">Hub Performance</div><div className="b2">Lead Command</div></div>
          </div>
          <nav className="filters" aria-label="Filtros">
            <div className="fp" data-f="periodo"><button type="button" className="pill" aria-haspopup="menu" aria-expanded="false"><span className="pk">Período</span><span className="pv" id="pvPeriodo"></span><i className="chev"></i></button><div className="pop" role="menu" aria-label="Período" hidden></div></div>
            <div className="fp" data-f="fontes"><button type="button" className="pill" aria-haspopup="menu" aria-expanded="false"><span className="pk">Fontes</span><span className="pv" id="pvFontes"></span><i className="chev"></i></button><div className="pop" role="menu" aria-label="Fontes" hidden></div></div>
            <div className="fp" data-f="status"><button type="button" className="pill" aria-haspopup="menu" aria-expanded="false"><span className="pk">Status</span><span className="pv" id="pvStatus"></span><i className="chev"></i></button><div className="pop" role="menu" aria-label="Status das campanhas" hidden></div></div>
            <div className="fp" data-f="campanhas"><button type="button" className="pill" aria-haspopup="menu" aria-expanded="false"><span className="pk">Campanhas</span><span className="pv" id="pvCamp"></span><i className="chev"></i></button><div className="pop" role="menu" aria-label="Campanhas" hidden></div></div>
          </nav>
          <div className="tb-r">
            <span className="demo" title="Números de exemplo gerados no navegador">Modo demo</span>
            <span className="clock"><b id="clock">--:--:--</b><small id="date"></small></span>
          </div>
        </header>

        <section className="cc">
          <aside className="col col-l">
            <article className="card fx pa kpi-hero" style={v({ '--i': '1' })}>
              <i className="glare"></i>
              <div className="ch"><h2>Leads no período</h2><span className="chip" id="chipPer"></span></div>
              <div className="big" id="kLeads">0</div>
              <div className="split" id="kSplit"></div>
              <div className="subl" id="kLeadsSub"></div>
              <div className="hspark" id="kSparkWrap"><canvas id="kSpark" aria-hidden="true"></canvas></div>
            </article>
            <div className="kgrid pa" style={v({ '--i': '2' })}>
              <article className="card mini fx"><i className="glare"></i><h3>Investimento</h3><b id="kInv">0</b><span id="kInvSub"></span></article>
              <article className="card mini fx" title="Investimento das campanhas de lead dividido pelos leads delas. Campanhas de audiência ficam fora da conta."><i className="glare"></i><h3>Custo por lead</h3><b id="kCpl">0</b><span id="kCplSub"></span></article>
              <article className="card mini fx"><i className="glare"></i><h3>Qualificados</h3><b id="kQual">0</b><span id="kQualSub"></span></article>
              <article className="card mini fx"><i className="glare"></i><h3>Vendas</h3><b id="kVen">0</b><span id="kVenSub"></span></article>
              <article className="card mini fx"><i className="glare"></i><h3>Seguidores novos</h3><b id="kSeg">0</b><span id="kSegSub"></span></article>
              <article className="card mini fx"><i className="glare"></i><h3>Visitas ao perfil</h3><b id="kVis">0</b><span id="kVisSub"></span></article>
            </div>
            <article className="card fx pa" style={v({ '--i': '3' })}>
              <i className="glare"></i>
              <div className="ch"><h2>Funil das campanhas de lead</h2></div>
              <div className="fwrap" id="fWrap"><canvas className="fill" id="funil" role="img"></canvas></div>
              <div className="sr-only"><table id="fTable"></table></div>
            </article>
          </aside>

          <div className="col col-c">
            <section className="card orbit-card pa" style={v({ '--i': '4' })} id="orbitCard">
              <div className="stage3d" id="stage3d">
                <canvas id="orbit" role="img"></canvas>
                <div className="ov-top">
                  <h2>Órbita do pipeline</h2>
                  <p id="orbitSub"></p>
                  <div className="olg">
                    <span><i style={v({ '--c': 'var(--meta)' })}></i>Meta Ads</span>
                    <span><i style={v({ '--c': 'var(--google)' })}></i>Google Ads</span>
                    <span><i className="won"></i>Venda</span>
                    <span><i className="stale"></i>Parado 7+ dias</span>
                  </div>
                </div>
                <div className="replay" id="replay">
                  <button type="button" className="rbtn" id="btnReplay"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1.2v7.6L8.6 5z" fill="currentColor" /></svg><span>Replay do período</span></button>
                  <div className="rrow"><div className="rtrack" aria-hidden="true"><i id="rbar"></i></div><span className="rdate" id="rdate" aria-live="off"></span></div>
                </div>
                <div className="otip" id="otip" hidden></div>
              </div>
              <div className="ask" id="ask" hidden>
                <div className="ans" id="ans" hidden>
                  <div className="ans-h"><span>Resposta do Claude</span><span className="sp"></span><button type="button" id="ansStop" hidden>Parar</button><button type="button" id="ansClose">Fechar</button></div>
                  <div className="ans-q" id="ansQ"></div>
                  <div className="ans-t" id="ansText" aria-live="polite"></div>
                  <div className="ans-n" id="ansNote"></div>
                </div>
                <form className="askf" id="askForm" autoComplete="off">
                  <svg className="ai" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0l1.8 5.2L15 7l-5.2 1.8L8 14l-1.8-5.2L1 7l5.2-1.8z" fill="currentColor" /></svg>
                  <label className="sr-only" htmlFor="askInput">Pergunte ao painel</label>
                  <input id="askInput" type="text" maxLength={300} placeholder="Pergunte ao painel. Ex.: onde o funil está travando?" />
                  <button type="submit" id="askSend">Perguntar</button>
                </form>
                <div className="sugs" id="sugs">
                  <button type="button">Onde o funil está travando?</button>
                  <button type="button">Qual campanha merece mais verba?</button>
                  <button type="button">A audiência está trazendo resultado?</button>
                  <button type="button">Resuma o período em 3 pontos</button>
                </div>
              </div>
            </section>
            <div className="crow">
              <article className="card fx pa" style={v({ '--i': '5' })}>
                <i className="glare"></i>
                <div className="ch"><h2>Leads por dia</h2><div className="ch-r"><div className="legend"><span id="lgM"><i className="lg" style={v({ '--c': 'var(--meta)' })}></i>Meta Ads</span><span id="lgG"><i className="lg" style={v({ '--c': 'var(--google)' })}></i>Google Ads</span></div><button type="button" className="mini-btn" id="tblBtn" aria-pressed="false">Tabela</button></div></div>
                <div className="dwrap" id="dWrap" tabIndex={0} aria-label="Leads por dia, use as setas para ver cada dia"><canvas className="fill" id="daily" role="img"></canvas><div className="tip" id="dTip" hidden></div></div>
                <div className="table-wrap" id="dTable" hidden></div>
              </article>
              <article className="card fx pa" style={v({ '--i': '6' })}>
                <i className="glare"></i>
                <div className="ch"><h2>CPL por fonte</h2><span className="chip">média de 7 dias</span></div>
                <div className="cplwrap" id="cplWrap" tabIndex={0} aria-label="CPL por fonte, use as setas para ver cada dia"><canvas className="fill" id="cpl" role="img"></canvas><div className="tip" id="cplTip" hidden></div></div>
              </article>
            </div>
          </div>

          <aside className="col col-r">
            <article className="card fx pa" style={v({ '--i': '7' })}>
              <i className="glare"></i>
              <div className="ch"><h2>Retorno</h2><span className="chip">receita ÷ investimento</span></div>
              <div className="gauge" id="gaugeWrap"><canvas id="gauge" aria-hidden="true"></canvas><div className="gc"><b id="roas">0</b><span>ROAS</span></div></div>
              <div className="roi-l">
                <div><span>Receita gerada</span><b id="rev">0</b></div>
                <div><span>ROI</span><b id="roi">0</b></div>
                <div><span>Custo por venda</span><b id="cac">0</b></div>
                <div><span id="roasLLbl">ROAS sem audiência</span><b id="roasL">0</b></div>
              </div>
              <p className="roi-note" id="roiNote"></p>
            </article>
            <article className="card fx pa etapas" style={v({ '--i': '8' })}>
              <i className="glare"></i>
              <div className="ch"><h2>Etapas no Pipedrive</h2><span className="chip" id="chipEtapas"></span></div>
              <ul className="stl" id="stl"></ul>
              <div className="stf" id="stf"></div>
            </article>
          </aside>
        </section>

        <section className="card aud pa" style={v({ '--i': '9' })}>
          <div className="ch"><h2>Audiência</h2><div className="ch-r"><span className="chip">tráfego para o perfil, vídeo e Instagram</span><button type="button" className="mini-btn" id="audTblBtn" aria-pressed="false">Tabela</button></div></div>
          <div className="aud-grid">
            <div className="aud-kpis">
              <div className="at"><h3>Seguidores novos</h3><b id="aSeg">0</b><span id="aSegSub"></span></div>
              <div className="at"><h3>Visitas ao perfil</h3><b id="aVis">0</b><span id="aVisSub"></span></div>
              <div className="at"><h3>ThruPlays de vídeo</h3><b id="aTp">0</b><span id="aTpSub"></span></div>
              <div className="at"><h3>Investimento em audiência</h3><b id="aInv">0</b><span id="aInvSub"></span></div>
            </div>
            <div className="aud-charts" id="audCharts">
              <div className="mc"><h3>Seguidores novos por dia</h3><div className="mwrap" id="mSegWrap" tabIndex={0} aria-label="Seguidores novos por dia"><canvas className="fill" id="mSeg" role="img"></canvas><div className="tip" id="mSegTip" hidden></div></div></div>
              <div className="mc"><h3>Visitas ao perfil por dia</h3><div className="mwrap" id="mVisWrap" tabIndex={0} aria-label="Visitas ao perfil por dia"><canvas className="fill" id="mVis" role="img"></canvas><div className="tip" id="mVisTip" hidden></div></div></div>
              <div className="mc"><h3>ThruPlays por dia</h3><div className="mwrap" id="mTpWrap" tabIndex={0} aria-label="ThruPlays por dia"><canvas className="fill" id="mTp" role="img"></canvas><div className="tip" id="mTpTip" hidden></div></div></div>
            </div>
            <div className="table-wrap aud-table" id="audTable" hidden></div>
          </div>
          <p className="aud-note">Seguidores novos vêm dos insights da conta do Instagram e somam orgânico e pago, por isso não mudam com o filtro de campanha. Visitas ao perfil e ThruPlays vêm das campanhas selecionadas.</p>
        </section>

        <section className="lower">
          <article className="card pa" style={v({ '--i': '10' })}>
            <div className="ch"><h2>Campanhas</h2><span className="chip" id="chipCamp"></span></div>
            <div className="objwrap" id="objWrap"></div>
            <div className="camps" id="camps"></div>
          </article>
          <article className="card pa" style={v({ '--i': '11' })}>
            <div className="ch"><h2>Eventos do Pipedrive</h2><span className="chip" id="chipEv"></span></div>
            <ol className="feed" id="feed"></ol>
          </article>
        </section>

        <footer className="foot">
          <span>Hub Performance · Lead Command</span>
          <span>Modo demo: números de exemplo gerados no navegador, nenhuma conta conectada</span>
        </footer>
      </div>
    </>
  );
}
