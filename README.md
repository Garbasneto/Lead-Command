# Lead Command · Hub Performance

Painel de comando da Hub Performance: junta Meta Ads, Google Ads e Pipedrive numa tela e aprende com os resultados.

**Situação atual:** protótipo portado para Next.js com o mesmo visual. Roda só com dados de demonstração (rotulados como "Modo demo"). Nenhuma conta conectada.

## Como ver rodando no seu Mac

1. Instale o Node.js (versão LTS) em https://nodejs.org, se ainda não tiver.
2. Baixe este repositório (no GitHub: botão verde "Code", depois "Download ZIP") e descompacte.
3. Abra o Terminal, entre na pasta e rode:

   ```
   npm install
   npm run dev
   ```

4. Abra http://localhost:3000 no navegador. Para parar, volte ao Terminal e aperte Ctrl+C.

## Comandos

| Comando | Para que serve |
|---|---|
| `npm run dev` | Roda em modo de desenvolvimento (atualiza sozinho ao editar) |
| `npm run build` | Gera a versão de produção (é o que a Vercel roda) |
| `npm start` | Roda a versão de produção depois do build |
| `npm run lint` | Confere o código |
| `npm run typecheck` | Confere os tipos do TypeScript |

## Onde fica cada coisa

- `CLAUDE.md`: instruções permanentes do projeto. O Claude Code lê sozinho no começo de cada sessão.
- `docs/ESPECIFICACAO.md`: produto, dados, inteligência e fases.
- `docs/VISUAL.md`: direção visual.
- `prototipo/hub-lead-command.html`: protótipo original, abre direto no navegador. Continua sendo a referência.
- `src/`: o app (veja a seção "Código" do `CLAUDE.md`).

## Segredos

Nenhuma chave ou token entra no repositório. O `.gitignore` bloqueia qualquer `.env`. O `.env.example` lista só os nomes das variáveis que vamos precisar; para usar, copie para `.env.local` e preencha.
