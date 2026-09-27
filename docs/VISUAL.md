# Direção visual do Lead Command

## O norte

Uma sala de comando de verdade: escura, precisa, viva, e sem nenhum pixel mentindo. O orgulho de olhar para a tela vem de ela ser bonita e verdadeira ao mesmo tempo. O protótipo em `prototipo/hub-lead-command.html` é o ponto de partida: primeiro portar igual, depois evoluir.

## Física honesta

Tudo que se move, cresce ou brilha representa um dado real. Se um efeito não tem dado por trás, ele sai.

| Elemento | O que representa |
|---|---|
| Anel da órbita | Uma etapa aberta do pipeline, na ordem do Pipedrive |
| Posição do ponto | A etapa atual do negócio |
| Tamanho do ponto | Valor do negócio |
| Cor do ponto | Fonte do lead (Meta `#19a898`, Google `#c98500`, outra fonte em cinza claro) |
| Velocidade de giro de cada anel | Velocidade real daquela etapa (inverso da mediana de dias na etapa nos últimos 30 dias). Etapa travada gira devagar. |
| Anel vermelho pulsando no ponto | Negócio parado há 7 dias ou mais |
| Cometa entrando pela borda | Lead novo chegando de verdade (webhook). Nunca simulado fora do modo demonstração. |
| Onda de choque no núcleo | Venda fechada |
| Ponto que se afasta e apaga | Negócio perdido |
| Brilho do núcleo | Receita fechada no período |
| Cor da atmosfera | Performance comparada com o próprio padrão (seção abaixo) |
| Rastro de um ponto | O caminho que o negócio fez até ali (trajetória) |

## Trajetórias

- Tocar num negócio (ou numa venda no núcleo) aproxima a câmera e desenha o caminho dele: da miniatura do criativo na borda, passando por cada etapa na data em que chegou, até onde está agora.
- Cada nó do caminho mostra etapa, data e tempo desde a etapa anterior. O feedback do Pipedrive (qualidade, objeção, nota) aparece junto.
- Tocar num criativo acende todos os negócios que ele gerou e mostra quantos viraram diagnóstico e venda.
- O "Replay do período" que já existe passa a desenhar as trajetórias ao longo do tempo.

## Atmosfera por performance

A ideia do Garbas: a tela muda de clima conforme a performance melhora ou piora. Regras para isso não virar ruído nem ansiedade:

- Um índice só comanda a atmosfera: valor em negócios que chegaram ao diagnóstico nos últimos 7 dias ÷ investimento das campanhas de lead nos mesmos 7 dias, comparado com a média e a variação dos 8 períodos de 7 dias anteriores.
- Zona neutra: dentro da variação normal (para começar, 1 desvio padrão; calibrar com os dados reais), nada muda.
- Cinco estados, de frio a quente, com transição lenta: no mínimo 6 horas para mudar de estado, interpolando a cor aos poucos.
- Temperatura, não semáforo. Frio vai para um azul aço dessaturado e com menos brilho; neutro é o verde-água atual (`#5eead4`); quente vai para dourado com mais brilho. Nunca vermelho.
- Muda só a atmosfera: núcleo, halo, poeira e um toque no fundo. Cores dos dados, textos e gráficos nunca mudam.
- Sempre com texto junto ("acima do seu padrão", "dentro do padrão", "abaixo do seu padrão") e, ao passar o mouse, o motivo com os números.
- Visão do cliente: atmosfera desligada por padrão.
- Com histórico curto demais para ter padrão, fica neutra e diz isso.

## Paleta e tipografia (vindas do protótipo)

- Fundo `#05090b`. Cartões com gradiente de `rgba(19,30,34,.72)` para `rgba(9,15,18,.68)`, borda `rgba(170,255,240,.075)`, borda em destaque `rgba(170,255,240,.16)`.
- Texto `#e6f1f0`, secundário `#9aafb0`, apagado `#64797b`. Linhas de grade `#14222a`, eixo `#223440`.
- Destaque `#5eead4` e `#2dd4bf`.
- Status: bom `#5fd47a`, ruim `#ff5d73`. Só para status.
- Etapas (escala ordenada): `#15665f`, `#1a8378`, `#1fa092`, `#2cbfae`, `#6fdccf`.
- Fontes: Geist para texto e números grandes, Geist Mono para rótulos técnicos e tabelas. Número grande com algarismos proporcionais; tabela com algarismos de largura fixa.

## Tecnologia da órbita

- WebGL com three.js (react-three-fiber). Pontos com instâncias (milhares sem pesar), brilho suave com bloom leve, profundidade real e câmera que se move nas trajetórias.
- Rótulos em HTML por cima do canvas, para texto nítido e acessível.
- Metas: 60 fps num MacBook Air. No iPad e no celular, menos partículas e sem bloom.
- Manter a versão em Canvas 2D do protótipo como plano B se o WebGL falhar.
- Pausar quando a órbita sai da tela ou a aba fica em segundo plano.

## Movimento

- Entrada cinematográfica curta (até 2 segundos) só no primeiro carregamento.
- Troca de filtro: os números e gráficos se transformam do valor antigo para o novo (até 0,7 segundo), sem piscar nem recarregar a tela.
- Animação nunca esconde um número por mais de um instante.
- "Reduzir movimento" ligado: tudo aparece no estado final, sem animação.

## Desktop primeiro, sem esquecer iPad e celular

- A partir de 1280 px: a central de comando cabe numa tela, sem rolar, em monitores a partir de 850 px de altura útil. O resto (audiência, campanhas, eventos) fica logo abaixo.
- iPad: órbita em cima, colunas embaixo.
- Celular: uma coluna, órbita menor, tudo tocável com o dedo.

## Modo sala

- Tela cheia para uma TV no escritório: alterna entre central, órbita e audiência a cada minuto (ajustável), fonte maior, sem interação.
- Mostra a hora da última atualização de cada fonte.
- Cometas e ondas de choque só com eventos reais.

## Atalhos para desktop

- Cmd+K abre uma busca rápida: campanha, criativo, negócio, pergunta ao painel.
- Setas navegam dia a dia nos gráficos (já existe no protótipo).

## O que nunca fazer

- Rótulo "ao vivo" ou "IA" sem o recurso existir.
- Número inventado fora do modo demonstração.
- Gráfico com dois eixos verticais.
- Filtro que recolore as séries.
- Vermelho tomando a tela.
- Tooltip como único jeito de ver um valor (sempre existe a tabela).
- Efeito bonito sem dado por trás.
