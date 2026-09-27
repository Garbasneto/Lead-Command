# Lead Command · Hub Performance

Painel de comando da Hub Performance, agência de tráfego pago e processo comercial que atende só arquitetos e designers de interiores (Portugal e Europa, EUA, Brasil). Junta Meta Ads, Google Ads e Pipedrive numa tela e aprende com os resultados.

Dono do projeto: Garbas. Ele não é programador. Fale com ele em português do Brasil, simples e direto.

## Antes de mexer em qualquer coisa

- Produto, dados, inteligência e fases: `docs/ESPECIFICACAO.md`
- Direção visual: `docs/VISUAL.md`
- Protótipo de referência (visual e cálculos): `prototipo/hub-lead-command.html`. Abre direto no navegador. É o piso de qualidade visual, não o teto.

## Como trabalhar com o Garbas

- Entregas pequenas, que ele consiga ver rodando. Ao terminar cada uma, diga em poucas linhas o que mudou e como testar.
- Pergunte antes de: qualquer coisa que gere custo, conectar conta real, apagar dados, trocar a stack ou mexer nas campanhas de anúncio.
- A IA do produto sugere. Ela nunca altera campanhas, orçamentos ou o Pipedrive sozinha.
- Siga as fases da especificação em ordem. Dado certo vem antes de efeito visual.
- Quando algo não puder ser feito como pedido, diga o motivo e a alternativa.

## Stack inicial (mudar só com motivo explicado)

- Next.js (App Router) com TypeScript, hospedado na Vercel.
- Supabase: Postgres (histórico e memória), Auth (login), Realtime (tela atualiza sozinha) e funções agendadas.
- Gráficos em Canvas 2D, portados do protótipo. A órbita evolui para WebGL (three.js via react-three-fiber), com versão leve para iPad e celular.
- IA: API do Claude pelo SDK oficial, sempre chamada no servidor.

## Código

- `src/app/`: rotas do Next.js. `layout.tsx` carrega as fontes (next/font) e `globals.css` é o CSS do protótipo sem mudanças.
- `src/components/CentralDeComando.tsx`: a marcação da tela, igual ao HTML do protótipo.
- `src/painel/`: o script do protótipo em TypeScript, que liga a tela depois de montada (`iniciar.ts`), com os gráficos em `graficos/`. Tudo o que ele liga é desligado ao sair (`ambiente.ts`).
- Órbita: `src/painel/graficos/orbitaGL.ts` (WebGL com three.js usado direto, no mesmo laço de animação do painel; react-three-fiber fica para quando a tela virar componentes React). Sem WebGL, cai para `orbita.ts` (Canvas 2D do protótipo). O que cada efeito representa está no topo do `orbitaGL.ts`.
- `src/lib/`: dados e regras, sem depender do navegador. `tipos.ts` é o formato que o painel consome, `demo/` gera os dados de demonstração e `metricas/computar.ts` é o lugar único das métricas.
- Antes de entregar: `npm run lint`, `npm run typecheck` e `npm run build`.
- Next.js 16 mudou bastante: as regras do framework para agentes ficam em @AGENTS.md (mantido pelo próprio `next dev`).

## Segurança

- Nenhuma chave ou token no repositório. `.env` no `.gitignore` desde o primeiro commit; manter `.env.example` só com os nomes das variáveis.
- Tokens de Meta, Google, Pipedrive e Anthropic ficam só no servidor. O navegador nunca vê.
- Dados de leads são dados pessoais (GDPR na Europa, LGPD no Brasil). Nada de dado pessoal em logs, e em prompts só o necessário.

## Métricas: regras que não mudam

- CPL = investimento das campanhas de lead ÷ leads dessas campanhas. Campanhas de audiência (tráfego para o perfil, vídeo) nunca entram no CPL nem no funil de leads.
- Cada campanha é medida pelo resultado do próprio objetivo: lead, visita ao perfil, ThruPlay.
- Retorno por coorte: receita ganha dos leads criados no período ÷ todo o investimento selecionado. Mostrar também o ROAS só das campanhas de lead.
- Qualificado, diagnóstico, proposta: contam negócios que chegaram à etapa, na data em que chegaram.
- Parado = 7 dias ou mais na mesma etapa sem movimento.
- Seguidores novos são da conta do Instagram (orgânico e pago somados) e não mudam com o filtro de campanha.
- O dia de hoje é parcial. Métricas da Meta ainda mudam por até 28 dias: marcar dias recentes como provisórios.
- Só aparece o que está ativo ou selecionado nos filtros, e os filtros valem para a tela inteira.

## Texto da interface

- Português do Brasil, com os textos centralizados para traduzir depois (inglês e espanhol).
- Nunca usar travessão (o traço longo) nem hífen duplo. Use vírgula, ponto, dois-pontos ou parênteses.
- Nada de frase genérica de IA e nada de rótulo falso ("ao vivo", "IA") sem o recurso existir de verdade.
- Nunca inventar número. Dado de demonstração sempre rotulado como demonstração.

## Visual: regras que não mudam

- Física honesta: tudo que se move, cresce ou brilha representa um dado real (tabela em `docs/VISUAL.md`).
- Cor dos dados é fixa por entidade: Meta Ads `#19a898`, Google Ads `#c98500`. Filtro nunca recolore.
- Verde e vermelho só para status. A atmosfera por performance segue as regras de `docs/VISUAL.md`.
- Todo gráfico tem uma tabela equivalente. Tooltip complementa, nunca é o único jeito de ver um valor.
- 60 fps num MacBook Air, respeitar "reduzir movimento" e pausar animação fora da tela.
