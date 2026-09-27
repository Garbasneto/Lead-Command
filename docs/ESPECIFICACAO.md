# Especificação do Lead Command

## 1. O que é e para quem

O Lead Command liga o anúncio à venda e aprende com isso. Ele mostra, num lugar só, quanto a Hub investiu, o que isso gerou em leads, diagnósticos, propostas e contratos, e por quê.

Quem usa, nesta ordem:
1. A própria Hub, no funil de aquisição da agência (anúncios que trazem arquitetos e designers como clientes).
2. Cada cliente da Hub, com a própria visão, no lugar do relatório semanal.
3. Talvez, no futuro, outras empresas. Só depois que provar valor dentro da Hub.

O diferencial não é o gráfico. É a linha de origem: cada lead carrega de onde veio (anúncio, criativo, público, respostas do formulário), e essa linha continua pelo atendimento, diagnóstico, proposta, venda ou perda, com o feedback do time registrado no Pipedrive. Com isso o produto responde qual criativo traz quem fecha, e não só quem clica.

## 2. As perguntas que ele precisa responder

1. Quanto investimos e o que isso gerou em leads, diagnósticos, propostas, vendas e receita, por campanha e por criativo?
2. Qual criativo e qual público trazem quem fecha?
3. Onde o funil está travando agora (etapas, parados, tempo em cada etapa)?
4. Quanto deve entrar nos próximos 30, 60 e 90 dias?
5. O que mudamos nas contas de anúncio e se funcionou?
6. O que aprendemos que vale para cada mercado (Portugal, Espanha, EUA, Brasil)?

Toda tela e todo recurso novo precisa ajudar a responder uma dessas perguntas.

## 3. Telas e módulos

- Central de comando: o que já existe no protótipo (leads, investimento, custo por lead, qualificados, vendas, seguidores, visitas, funil, órbita, leads por dia, CPL por fonte, retorno, etapas).
- Órbita com trajetórias: tocar num negócio mostra o caminho inteiro dele, do criativo até a etapa atual (detalhes em `VISUAL.md`).
- Audiência: seguidores novos, visitas ao perfil, ThruPlays e investimento em audiência, cada um com custo por resultado.
- Campanhas por objetivo: tabela por objetivo e cards medidos pelo resultado de cada objetivo.
- Criativos: ranking de criativos por diagnóstico e venda, não só por CPL, com a miniatura do anúncio.
- Eventos: linha do tempo do Pipedrive e das contas de anúncio.
- Pergunte ao painel: perguntas em linguagem natural respondidas com os dados do banco (seção 9).
- Diário de decisões: mudanças feitas nas contas, a hipótese de cada uma e o veredito depois (seção 9).
- Aprendizados: a memória do produto, com evidência e grau de confiança de cada aprendizado.
- Previsão: receita provável dos próximos 30, 60 e 90 dias, com faixa (seção 12).
- Modo sala: tela cheia para uma TV no escritório (detalhes em `VISUAL.md`).

## 4. Funil e etapas

As etapas vêm do Pipedrive, nunca fixas no código. O funil atual da Hub é: formulário, contato no WhatsApp em minutos, chamada de diagnóstico, proposta em PDF, acompanhamento. No Pipedrive isso deve virar etapas equivalentes (confirmar com o Garbas os nomes exatos antes de mapear).

A órbita cria um anel por etapa aberta, na ordem do pipeline. Ganho vai para o núcleo; perdido sai da órbita.

## 5. Métricas

As regras fixas estão no `CLAUDE.md`. Métricas que o produto precisa ter, além das que já estão no protótipo:
- Taxa de diagnóstico: negócios que chegaram ao diagnóstico ÷ leads do período.
- Custo por diagnóstico: investimento das campanhas de lead ÷ diagnósticos.
- Tempo até o primeiro contato: da criação do lead até a primeira atividade ou mudança de etapa registrada.
- Tempo médio em cada etapa e ciclo até a venda.
- Custo por venda, ticket médio, receita por coorte.
- Cobertura do feedback: parte dos negócios com os campos de feedback preenchidos (seção 8). Aparece na tela, porque a inteligência depende disso.
- Cobertura da origem: parte dos negócios com a origem do anúncio gravada (seção 7).

Toda métrica tem definição escrita num único lugar do código e aparece com uma explicação curta ao passar o mouse.

## 6. Fontes de dados e integrações

### Meta Ads (Marketing API)
- Contas, campanhas (com o objetivo), conjuntos, anúncios e criativos (miniatura e texto).
- Insights diários por anúncio: investimento, impressões, cliques, leads, visitas ao perfil, ThruPlays e resultados.
- Sincronizar de forma periódica (a Meta atualiza os insights a cada 15 minutos) e reprocessar os últimos 28 dias, porque os números ainda mudam nesse prazo.
- Histórico de alterações da conta (`/act_{id}/activities`), usado no diário de decisões. Por padrão ele devolve os últimos 7 dias, então sincronizar todo dia para não perder nada.

### Meta Lead Ads (formulário nativo)
- Receber leads em tempo real por webhook (campo `leadgen` da página). A Meta avisa em até alguns minutos.
- O aviso traz `leadgen_id`, `page_id`, `form_id`, `ad_id` e `created_time`. As respostas do formulário vêm numa segunda chamada (`GET /{leadgen_id}`). Conjunto e campanha: buscar a partir do `ad_id`.
- Lead orgânico ou de teste não tem anúncio. Tratar à parte.

### Respondi
- Parte dos leads vem por formulário do Respondi, que termina num link para o WhatsApp. A origem precisa vir por UTMs em campos ocultos. Levantar com o Garbas como esses leads chegam hoje ao Pipedrive antes de integrar.

### Instagram
- Seguidores novos por dia, pelos insights da conta profissional. Verificar a métrica e quanto histórico a API devolve; se o histórico for curto, gravar todo dia a partir do primeiro dia de integração.

### Pipedrive
- Negócios, etapas, pessoas, atividades, notas, motivos de perda e campos personalizados.
- Histórico de mudança de etapa de cada negócio, com data. Carregar o histórico existente na primeira sincronização e, daí em diante, registrar cada mudança recebida.
- Tempo real por webhooks (versão 2: eventos de criação, alteração e exclusão). Confirmar quais objetos têm webhook. O Pipedrive tenta reenviar um aviso que falhou, então o recebimento precisa ser idempotente.

### Google Ads (fase 3)
- API com token de desenvolvedor, que depende de aprovação do Google. Pedir o token logo no começo do projeto.
- Histórico de alterações pelo recurso `ChangeEvent` (cobre só os últimos 30 dias, então sincronizar todo dia).
- Métricas de custo e cliques têm meta de até 1 hora de atraso; conversões podem levar mais.

## 7. A linha de origem (lead ligado ao negócio)

- Todo negócio criado a partir de um lead grava nos campos do Pipedrive: ID do lead da Meta, `ad_id`, `adset_id`, `campaign_id`, `form_id` (ou as UTMs, no caso do Respondi).
- Se o ID não vier, ligar por telefone ou e-mail normalizados e marcar a ligação como "por aproximação".
- A tela mostra a cobertura da origem. Negócio sem origem aparece como "origem desconhecida", nunca é distribuído entre campanhas.

## 8. Feedback no Pipedrive

Decisão do Garbas: o conteúdo do WhatsApp não será lido direto. O feedback de cada conversa entra no Pipedrive, e é isso que alimenta a inteligência.

Campos a criar no Pipedrive (listas fechadas, para caber em menos de 30 segundos por lead):
- Qualidade do lead, depois do primeiro contato: quente, morno, frio, sem resposta.
- Perfil do escritório: sozinho, 2 a 5 pessoas, 6 ou mais.
- Urgência: quer começar agora, nos próximos 3 meses, sem prazo.
- Principal objeção: preço, momento, já tem agência, desconfiança, não entendeu a proposta, outra.
- Motivo de perda: usar os motivos de perda nativos do Pipedrive, com lista fechada.
- Nota da conversa: 2 a 3 linhas depois do WhatsApp e depois do diagnóstico, em texto livre.
- Atividade "Diagnóstico", marcada como agendada e como feita.

Regras:
- As notas de texto livre são classificadas por um modelo rápido (seção 9) em etiquetas estruturadas. Se o time preencher um campo, o campo manda e a etiqueta da IA fica como sugestão.
- Onde o formulário já responde (perfil, faturamento, urgência), o produto preenche o campo sozinho e o time só corrige.
- Com pouco feedback preenchido, as conclusões perdem valor. O produto avisa isso em vez de concluir com base fraca.

## 9. Inteligência: como ele aprende

O modelo de IA não aprende sozinho com o uso: cada chamada à API começa do zero. Quem aprende é o que é construído em volta dele, e tudo fica no banco.

### O que é guardado
- Fatos: métricas diárias por anúncio, leads, negócios, mudanças de etapa, notas e etiquetas.
- Decisões: cada mudança nas contas de anúncio, com a hipótese e o veredito.
- Aprendizados: frase curta, mercado, evidência (números e consulta que os gerou), confiança, data, situação (hipótese, validado, descartado).
- Insights e recomendações gerados, com o feedback do Garbas (útil ou errado, e por quê).
- Previsões, com o valor real registrado depois.

### Rotinas agendadas
- Diária (modelo rápido): leads sem resposta, negócios parados, anomalias de custo ou volume, classificação das notas novas.
- Semanal (modelo mais capaz): compara previsões com o que aconteceu, julga as decisões que venceram o prazo, atualiza os aprendizados e gera de 3 a 5 insights, cada um com evidência, motivo e como confirmar. Pode rodar em lote (Batch API) para custar menos.

### Diário de decisões
- Puxa as mudanças das contas (Meta activities e, depois, Google ChangeEvent).
- Pede ao Garbas a hipótese em uma linha, dentro do app.
- Depois de um prazo (7 ou 14 dias, conforme o volume), compara com o período anterior equivalente e dá o veredito: funcionou, não funcionou, ou ainda sem dados suficientes. Definir uma amostra mínima abaixo da qual ele não conclui.

### Pergunte ao painel
- Chamado no servidor, com o modelo mais capaz por padrão.
- O modelo usa ferramentas que consultam o banco (funções de consulta definidas por nós), em vez de receber um bloco gigante de dados.
- Toda resposta com número mostra de onde ele veio. Se a amostra for pequena, a resposta diz. Nunca inventa benchmark.
- Os aprendizados relevantes entram no contexto da pergunta.
- Registrar o custo de cada pergunta e mostrar o gasto do mês com IA numa área de administração.

### Modelos (API do Claude)
- `claude-fable-5-1`: revisão semanal e perguntas estratégicas. O mais capaz.
- `claude-sonnet-5`: perguntas do dia a dia, se o custo pesar.
- `claude-haiku-4-5-20251001`: classificação de notas e leads em tempo real.
- Usar cache de prompt no contexto fixo (instruções, definições, aprendizados).
- Preço e disponibilidade mudam: conferir a documentação da Anthropic antes de fixar valores no código.

### Regras de honestidade
- Toda afirmação numérica vem de uma consulta registrada.
- Correlação não é apresentada como causa.
- A IA recomenda; ações nas contas de anúncio ou no Pipedrive só com confirmação do Garbas (e só a partir da fase 4).

## 10. Tempo real

- Na hora: lead novo (webhook da Meta), movimentos no Pipedrive (webhooks). Chegam ao banco e o Supabase Realtime atualiza a tela aberta.
- Com atraso: métricas de anúncio, por sincronização periódica. Dias recentes aparecem como provisórios.
- A tela mostra a hora da última sincronização de cada fonte. Nada de "ao vivo" em dado que não é.

## 11. Sinal de volta para os algoritmos (fase 3)

- Na Meta, a meta de otimização Conversion Leads: enviar as etapas do Pipedrive de volta pela Conversions API para a Meta buscar pessoas parecidas com quem avança no funil.
  - Só funciona com formulário nativo da Meta.
  - Exige o ID do lead da Meta guardado no CRM, no mínimo 200 leads por mês, envio pelo menos diário, etapa atingida em até 28 dias e convertendo entre 1% e 40% dos leads. Depois vem uma fase de aprendizado de 2 a 4 semanas.
  - Etapa candidata no funil da Hub: diagnóstico agendado.
  - Enquanto o volume não chega ao mínimo, o produto mostra quanto falta.
- Google: conversões otimizadas para leads. Desde junho de 2026 o envio passa pela Data Manager API.

## 12. Previsão de receita

- Base: histórico próprio de conversão de cada etapa e do tempo até fechar, por mercado.
- Resultado: receita provável em 30, 60 e 90 dias, com faixa (por exemplo, simulação dos negócios abertos).
- Abaixo de um histórico mínimo de negócios fechados, mostrar "histórico insuficiente" em vez de número.
- Cada previsão é guardada e comparada com o real depois. A tela mostra o quanto as previsões têm acertado.

## 13. Clientes e inteligência do nicho (fase 4)

- Um espaço por cliente, com login próprio e uma visão mais contida (sem atmosfera de performance por padrão).
- A visão do cliente substitui o relatório semanal.
- Aprendizados somados entre clientes, de forma anônima: custo por diagnóstico por cidade, ângulo criativo que gera reunião, tempo até fechar. Só com autorização prevista em contrato e respeitando GDPR e LGPD.

## 14. Acessos que o Garbas vai precisar providenciar

Na ordem em que entram:
1. GitHub, Vercel e Supabase (contas).
2. Console da Anthropic: chave da API e forma de pagamento. É separado da assinatura do Claude.
3. Meta: app de desenvolvedor e usuário do sistema no Gerenciador de Negócios, com permissões de anúncios, leads e página. Algumas permissões podem pedir revisão da Meta.
4. Pipedrive: token de API e permissão para criar webhooks e campos.
5. Instagram: conta profissional ligada à página.
6. Google Ads: token de desenvolvedor (pedir cedo) e acesso à conta.

## 15. Fases e critério de pronto

### Fase 1: base e dados reais do funil da Hub
- Projeto criado, login só para o Garbas, protótipo portado com o mesmo visual.
- Meta Ads e Pipedrive conectados, histórico carregado, origem gravada em cada negócio novo.
- Leads e mudanças de etapa aparecendo na tela sem recarregar.
- Pronto quando: os números batem com o Gerenciador de Anúncios e com o Pipedrive no mesmo período (diferenças explicadas), um lead novo aparece na tela em minutos e todo negócio novo tem origem.

### Fase 2: feedback e inteligência
- Campos de feedback no Pipedrive, classificação das notas, cobertura do feedback na tela.
- Banco de aprendizados, rotinas diária e semanal, diário de decisões, Pergunte ao painel com ferramentas.
- Órbita com trajetórias e física honesta.
- Pronto quando: a revisão semanal cita números conferíveis e o diário deu veredito em pelo menos uma decisão real.

### Fase 3: Google Ads, sinal de volta e previsão
- Google Ads conectado, envio das etapas para a Meta quando o volume permitir, previsão de receita com faixa.
- Atmosfera por performance ligada.

### Fase 4: clientes, nicho e modo sala
- Espaço por cliente, aprendizados do nicho, modo sala, ações com confirmação.

## 16. Fora do escopo por enquanto

- Ler o conteúdo do WhatsApp direto.
- A IA mexer sozinha em campanha, orçamento ou Pipedrive.
- Vender o produto para outras empresas.
