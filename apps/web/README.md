# @aprendemais/web — SPA da plataforma

React 19 + Vite + `react-router`. Telas do Sprint 1 (fluxos em `docs/ux/fluxos.md`): login, cadastro de aluno (ramo < 18 → e-mail do responsável), espera de autorização, autorização do responsável (por link), recuperação de acesso, confirmação de e-mail, escolha de papel e home vazia de aluno e professor. Componentes e tokens: `@aprendemais/ui`. Contrato da API: `apps/api/openapi/auth.yaml` + `@aprendemais/shared-types`.

## Mock × API real
Uma variável decide, em **build time**: `VITE_API_MOCK` (ver `.env.example`; copie para `.env.local`).

| Comando | API usada |
|---|---|
| `pnpm --filter @aprendemais/web dev` | **simulada** (MSW no navegador), é o padrão sem a variável |
| `VITE_API_MOCK=false pnpm --filter @aprendemais/web dev` | **real**: `/api/v1` com proxy do Vite → `wrangler dev` da API (`localhost:8787`) |
| `pnpm --filter @aprendemais/web build` | **real** (padrão do build); o MSW e o painel **não entram** no pacote |
| `VITE_API_MOCK=true pnpm --filter @aprendemais/web build` | simulada (ex.: preview de demonstração) |
| `pnpm --filter @aprendemais/web test` | sempre simulada (MSW em Node) |

Sem backend: o modo simulado imita o contrato inteiro de auth/consentimento (`src/mocks/`), inclusive `Idempotency-Key`, link de uso único, 428/429 e as regras de menor × 18+. Toda resposta de sucesso é conferida contra o schema do contrato antes de sair, então o mock não consegue divergir sem um teste falhar.

### O que o modo simulado oferece
- **Painel "Modo simulado"** (canto da tela): lista os "e-mails" enviados (E1 autorização, E3 confirmação, E4 recuperação) com o link para abrir, as contas de teste e "Reiniciar dados". Os dados ficam em `sessionStorage` da aba (recarregar mantém a sessão; outra aba começa do zero).
- **Contas de teste** (fictícias; `src/mocks/banco.ts`): `LeaoAzul42` / `girafa-lunar-914` (aluno, 5º ano) · `aguia.prata@example.test` / `trilha-segura-2026` (18+) · `ana.professora@example.test` / `professora-ana-2026` · `duplo.exemplo@example.test` / `duplo-exemplo-2026` (aluno + professor) · `gestora.exemplo@example.test` / `gestora-exemplo-2026` · `NuvemCinza88` / `nuvem-cinza-2026` (em exclusão).
- **Gatilhos de estado**: e-mail iniciando em `limite@` → 429 no cadastro · `falha@` → 500 · `desafio@` → 428 (marque "Não sou um robô (desafio de teste)"). No login, 3 senhas erradas seguidas → 428; 10 → 429. Recuperação: identificador iniciando em `limite` → 429, `desafio` → 428. Senhas "comuns" recusadas: `12345678`, `senha123`, `password`…
- Intervalo mínimo entre reenvios no mock: 30 s (o real é ≤ 3/dia).

## Estrutura
| Pasta | O quê |
|---|---|
| `src/api/` | `cliente.ts` (cliente tipado por `OPERACOES_AUTH`: método, rota, corpo e resposta vêm do contrato; devolve `{ok,data}` ou `{ok:false,code,details,requestId}`, nunca lança) · `mensagens.ts` (catálogo pt-BR por `code` e por campo) |
| `src/estado/` | `ApiProvider` (injeta o cliente) · `SessaoProvider` (`GET /me`; fases `anonima` = 401, `encerrada` = a pessoa saiu) |
| `src/paginas/` | uma tela por arquivo (+ `.test.tsx`) |
| `src/componentes/` | `TelaPublica`, `Titulo` (foca o `<h1>` a cada tela e lê/limpa `?t=`), `ResumoDeErros`, `CampoSenha`, `Desafio` (Turnstile), `Protegida`, estados T16 |
| `src/lib/` | validação do cliente (espelha o **formato** do contrato), `pareceMenor` (só texto do passo 2), `etapaDe`, senha sugerida |
| `src/mocks/` | `banco.ts` + `handlers.ts` (MSW) · `navegador.ts` · `servidor.ts` (testes) · `PainelMock.tsx` |
| `src/testes/` | preparo do Vitest, `renderizarApp` (StrictMode + MemoryRouter), atalhos que usam a própria API simulada |

## Decisões desta entrega
- **Sem regra de negócio no cliente.** O cliente só valida formato (8–128 caracteres, e-mail, mês/ano) e escolhe o texto do passo 2 por uma estimativa de idade; quem decide menor/maior, senha comum, apelido em uso e consentimento é o servidor (a resposta traz `menor`).
- **Token de link** (`?t=`): lido uma vez e removido da URL (`replace`); fica só em memória. **Recarregar a página perde o link** (vira "Este link não funciona") — comportamento do `fluxos.md`.
- **Nada de dados de menor no navegador**: o rascunho do cadastro fica só em memória e T05 vem de `GET /me`.
- **Erros**: o texto exibido vem do catálogo, nunca do `message` cru da API; 500 mostra o `X-Request-Id`; 403 e 404 usam o mesmo texto.
- **Idempotency-Key**: gerada por tentativa; reutilizada ao reenviar o mesmo corpo, nova se o corpo mudou (cadastro e autorização).
- **Turnstile** (DC-06): só aparece após 428. Configure `VITE_TURNSTILE_SITE_KEY` (chave pública). A CSP/rotas precisam permitir `https://challenges.cloudflare.com`.
- Textos dos avisos de privacidade são **provisórios** (`src/conteudo/avisos.ts`) até a PED-02; a **versão** aceita vem sempre da API.

## Fora desta entrega
T08 (gerenciar/revogar autorização), T11 (cadastro de professor por convite) e o menu "Minha conta": os contratos existem (`consultarGestaoConsentimento`, `cadastrarProfessor`…), mas as telas não foram pedidas; ver `PENDENCIAS.md`.
