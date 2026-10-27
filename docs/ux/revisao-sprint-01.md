# Revisão UX e acessibilidade — Sprint 1 · S1-UX-02

2026-10-26 · UX · Escopo: telas de `apps/web` (T01–T07, T09, T10, T12–T16) contra `fluxos.md`, `principios.md` e WCAG 2.2 AA. **T08 e T11 não existem** (PEN-043), então ficam de fora.

**Método e limite.** Leitura do código (`apps/web/src`, `packages/ui/src/styles`), cálculo de contraste dos pares de `tokens.css` e leitura de `docs/qa/relatorio-sprint-01.md`. **Não abri as telas em navegador nem em leitor de tela.** Os itens marcados *confirmar* vêm de leitura de CSS/JSX e precisam de um olhar de QA no navegador. O axe do QA roda com tags **WCAG 2.1 AA**: não cobre contraste de foco (2.4.13), tamanho de alvo (2.5.8), foco perdido nem ordem de foco. "0 sérias/críticas" não equivale a "passa na 2.2".

## 1. Resumo
- **Contraste de texto e de componentes: ok.** Nenhum par de token reprova (§2).
- **Estrutura: boa.** Um `<h1>` por tela com foco programático, rótulo visível em todo campo, erro com texto e ícone, resumo de erros com foco, `lang="pt-BR"`, modal em `<dialog>`, 360 px sem rolagem (QA).
- **Achados: 16 defeitos** (5 de severidade média, 11 baixos) e as decisões de PEN-036 e PEN-046. Nada bloqueia a sprint; os de severidade média devem sair antes de dado real de aluno.
- Os 5 mais importantes: A1 (foco invisível no menu e no modal), A2 (foco perdido em T05), A3 (T06 sem o aviso completo), A4 (botão "Autorizar" desabilitado) e A5 (recarregar T06/T10/T12).

## 2. Contraste (calculado sobre `tokens.css`)
| Par | Razão | Mín. | Resultado |
|---|---|---|---|
| texto `muted` sobre branco / superfície / tint / accent-tint | 6,14 / 5,71 / 5,44 / 5,69 | 4,5 | ok |
| link/botão azul sobre branco / superfície / tint | 7,01 / 6,52 / 6,21 | 4,5 | ok |
| alertas fg×bg: info / sucesso / aviso / erro | 6,21 / 5,77 / 6,61 / 6,84 | 4,5 | ok |
| erro de campo (`error-solid`) sobre branco / superfície | 6,54 / 6,08 | 4,5 | ok |
| branco sobre `error-solid`, hover do danger (`#98201a`), hover do primário, navy | 6,54 / 8,21 / 8,43 / 14,27 | 4,5 | ok |
| borda de campo e checkbox (`neutral.border`) sobre branco / superfície | 3,51 / 3,27 | 3 | ok |
| anel de foco azul sobre branco / superfície / tint | 7,01 / 6,52 / 6,21 | 3 | ok |
| anel de foco amarelo sobre navy | 7,87 | 3 | ok |
| **anel de foco amarelo sobre branco** | **1,8** | 3 | **reprova — ver A1** |
| botão desabilitado (opacidade .6) | 2,94 | isento | isento, mas ver A4 |

## 3. Checklist
✔ ok · ✖ falha (achado) · ~ parcial · n/a não existe nesta versão

| Critério | Estado | Onde / achado |
|---|---|---|
| 1.3.1 estrutura: `h1` único, `h2` em blocos, landmarks, listas | ✔ | `TelaPublica`/`AppShell`; T06 usa `h2` + `ul aria-labelledby` |
| 1.3.5 finalidade do campo (`autocomplete`) | ✔ | `username`, `current-password`, `new-password`, `email`, `name` |
| 1.4.3 / 1.4.11 contraste de texto e de componentes | ✔ | §2 |
| 1.4.10 reflow 320 px, 1.4.4 zoom | ~ | QA confirmou 360 px; A15 (apelido no campo de 1 linha) *confirmar* a 320 px |
| 2.1.1 / 2.1.2 teclado, sem armadilha | ~ | modal e `Esc` ok (QA); A11 (menu não fecha ao sair com Tab) |
| 2.4.2 título da aba por tela | ✔ | `Titulo` define `document.title` |
| 2.4.3 ordem e gestão de foco | ✖ | A2 (foco se perde em T05); troca de tela leva o foco ao `h1` (ok) |
| 2.4.6 rótulos claros | ~ | A6 (botão "Criar conta" para voltar) |
| 2.4.7 / 2.4.13 foco visível | ✖ | A1 |
| 2.5.8 alvo ≥ 24 px (AA) | ✔ | menor controle = 36 px (`sm`); links isolados ~24 px (A16) |
| alvo ≥ 44 px (`principios.md`) | ~ | A10, A16 |
| 3.2.6 ajuda consistente | n/a | nenhuma tela oferece contato; depende do canal de PEN-013 |
| 3.3.1 / 3.3.3 erro identificado e sugerido | ~ | ok em T01/T02–T04/T09/T10; falta em T05 (A2); mensagens vagas (A14) |
| 3.3.2 rótulos e instruções | ~ | A9 (obrigatório marcado só em parte dos campos) |
| 3.3.7 entrada redundante | ✔ | nada é pedido duas vezes; o rascunho fica em memória |
| 3.3.8 autenticação acessível | ✔ | colar e gerenciador de senha liberados; Turnstile só após 428 e sem enigma |
| 4.1.2 nome, papel e estado | ~ | A7 (Mostrar/Ocultar) |
| 4.1.3 mensagens de status | ~ | `role=status`/`alert` presentes; A12 (região duplicada, erro geral sem foco) |
| Tom e linguagem (`principios.md` §1) | ~ | A8, A14; frases curtas e culpa no sistema ("Não foi culpa sua"): ✔ |
| Fluxo × `fluxos.md` | ~ | A3, A4; T08/T11 ausentes (PEN-043) |

## 4. Achados
Cada linha tem um registro em `PENDENCIAS.md` (PEN-069 a PEN-084).

| ID | Sev. | Tela | Achado | Correção sugerida |
|---|---|---|---|---|
| A1 | média | menu e modal "Privacidade" (T13/T14) | O cabeçalho usa `.am-on-dark`, que troca `--am-focus-color` para amarelo. Menu e `<dialog>` ficam **dentro** desse elemento e herdam o amarelo, mas têm fundo branco: anel de foco ≈ 1,8:1 (mín. 3). *Confirmar no navegador.* | Redefinir `--am-focus-color` para o azul em `.web-menu__lista` e em `.am-modal` |
| A2 | média | T05 | "E-mail errado? Corrigir" desmonta o botão e o foco vai ao `body`; o mesmo ocorre em "Cancelar" e após enviar. Erro de e-mail só aparece em linha, sem resumo nem foco (`fluxos.md` §9) | Foco no campo ao abrir; ao cancelar/enviar, foco no botão de origem ou no aviso; usar `ResumoDeErros` |
| A3 | média | T06 | Falta o link "Aviso de privacidade completo" previsto no wireframe: o responsável decide sem acesso ao texto completo | Abrir o aviso do responsável em `Modal` (texto da PED-02) |
| A4 | média | T06 | "Autorizar" usa `disabled`: sai da ordem de Tab, o texto fica a 2,94:1 e a dica "escreva seu nome e marque a caixa" não é alcançada. A validação no envio (`Marque a caixa…`) nunca roda | Manter o botão habilitado, validar no envio com resumo de erros (§9 prevalece sobre a regra de T06) |
| A5 | média | T06, T10, T12 | Recarregar leva a "Este link não funciona". Em T06 o texto manda "criar a conta de novo" mesmo se acabou de autorizar. Em T12 "Reenviar link" vai a T05, que sem sessão cai em "Sua sessão acabou". Ver PEN-046 (§5) | Textos de §5 e, depois, fragmento `#t=` |
| A6 | baixa | T02–T04 | O voltar dos passos 2 e 3 se chama "Criar conta", quase igual ao botão final "Criar minha conta". O passo não entra no histórico: o Voltar do navegador (e do Android) sai do cadastro e perde o rascunho | Rótulo "Voltar"; um passo por entrada no histórico |
| A7 | baixa | T01, T04, T10 | "Mostrar/Ocultar" muda o rótulo **e** usa `aria-pressed`: o leitor diz "Ocultar, botão alternável, ativado" | Rótulo fixo "Mostrar senha" + `aria-pressed` |
| A8 | baixa | T01 | "Usuário ou e-mail" e "Usuário ou senha incorretos": `principios.md` §1 veta "usuário", e o resto do fluxo diz "apelido" (T02, T09) | "Apelido ou e-mail" / "Apelido ou senha incorretos". Ajusto `fluxos.md` e o catálogo junto |
| A9 | baixa | T01–T04, T06, T09 | "(obrigatório)" aparece em e-mail e senha, mas não nos selects do passo 1, em T01 nem na caixa de T06 | Dizer uma vez "Todos os campos são obrigatórios" ou marcar todos |
| A10 | baixa | T05, T04, alertas | `Button size="sm"` (36 px) fora de tela de professor: "Copiar" (aluno), "Ler o aviso" (aluno; fica **dentro** do `label` do checkbox, entra no nome do campo), "Tentar de novo" | Usar `md`; mover "Ler o aviso" para fora do `label` (como no wireframe) |
| A11 | baixa | T13/T14 | O menu do usuário só fecha por clique fora ou `Esc`: com Tab, fica aberto sobre o conteúdo. O logo da área logada se chama "ir para entrar" | Fechar no `focusout`; logo leva ao início do papel |
| A12 | baixa | T05, T09, T04, T06 | `<div aria-live>` envolve `Alert role=status/alert` (anúncio duplo). Erro geral de T04/T06 usa `Alert` sem foco, ao contrário de T01/T09/T10 | Uma só região viva; usar `ResumoDeErros` nos erros gerais |
| A13 | baixa | T16, T12 | "Tentaremos de novo quando voltar" não tem ouvinte de `online` (a promessa é falsa); T12 com erro de rede não oferece "Tentar de novo" | Implementar o ouvinte ou tirar a frase; botão de nova tentativa |
| A14 | baixa | T04, T06 | "Marque para continuar." não diz o quê | "Marque que você leu o aviso para continuar." |
| A15 | baixa | T02 | Apelido em `<input readOnly>` de 1 linha ao lado de "Sortear outro": apelidos longos podem ser cortados a 320–360 px, e é ele que o aluno precisa anotar. *Confirmar.* | Mostrar o apelido como texto grande (como em T05) com o botão abaixo |
| A16 | baixa | T01, T05 | Links soltos ("Esqueci minha senha", "Já foi autorizado? Entrar") têm ≈ 24 px de altura: passam na 2.5.8, não nos 44 px | `min-height` de alvo nesses links |

Decisão registrada sem pendência: "Não autorizar" apaga o cadastro com 1 clique, sem confirmação. Mantemos: o peso visual é igual ao de "Autorizar" (RQ-08), autorizar exige nome e declaração (então a recusa por engano é o erro de menor dano) e o aluno pode refazer o cadastro. A tela de resultado já diz o que foi apagado.

## 5. Respostas às decisões
### PEN-036 — botão `danger` e tamanho `sm`
- **(a) Hover do `danger`: aceito.** `color-mix(… 85%, black)` dá `#98201a`, branco sobre ele 8,21:1. Vira o token `color.feedback.error.solid-hover` em `tokens.json` quando a T08 (único uso previsto) for construída; até lá o `color-mix` fica.
- **(b) `sm` = 36 px: aceito só em telas densas de professor** (T14 em diante: linhas de tabela, ações em lista), com ≥ 8 px entre alvos (passa a 2.5.8 AA, mín. 24 px). **Proibido** em telas públicas, de aluno e de responsável. Hoje há 3 usos fora da regra (A10). `principios.md` §3 ganha essa regra na próxima revisão.

### PEN-046 — recarregar T06/T10/T12 perde o link
- **Não** guardar o token em `sessionStorage`: fica legível por qualquer script da página e em computador compartilhado de escola ou lan house permanece até fechar a aba. Também contraria a regra "nada de dados de menores no navegador" de `fluxos.md` §9.
- **Não** resolver só com "não recarregue esta página": quase ninguém vê, e o erro seria da pessoa, não do sistema.
- **Decisão:** adotar o fragmento `#t=` já pedido em PEN-054. Ele não vai ao servidor, aos logs nem ao `Referer`. A SPA lê o token e **mantém** o fragmento até a ação terminar (autorizar, recusar, salvar senha) e só então limpa com `replace`. Com isso recarregar T06 e T10 funciona, porque consultar o link não o gasta.
- **T12 gasta o token ao abrir.** Para sobreviver ao recarregar, trocar por um botão "Confirmar meu e-mail" que só chama a API ao clicar. Isso também impede que um antivírus ou leitor de e-mail que abre links gaste o link.
- **Enquanto isso (só texto, sem mudar fluxo):**
  - T06 inválido: "Se você acabou de autorizar ou recusar, já está tudo certo. Se não, o link pode ter expirado ou já ter sido usado. Peça ao aluno para criar a conta de novo." (continua igual para link desconhecido, vencido ou usado: nada vaza.)
  - T12 inválido: "Se você já confirmou, é só entrar." com **Entrar** como botão principal; "Reenviar link" só como secundário.
  - T10 inválido: manter "Pedir outro link" e acrescentar "Se você acabou de trocar a senha, entre com a nova."
- Por que importa: cada link novo gasta o limite de pedidos do aluno (PEN-063).

## 6. Não coberto
- Nada foi visto em navegador real, leitor de tela (NVDA, TalkBack) ou zoom de 200%; recomendo uma passada de QA nos itens *confirmar* (A1, A15) e a primeira rodada com leitor de tela antes do piloto.
- T08, T11 e ranking não existem; revisar quando entrarem (PEN-043). T13 para Fund. I (ícones grandes, `fontBase` 18) só tem o esqueleto.
- Textos finais dos avisos e e-mails são da PED-02 (PEN-044); não avaliei a linguagem deles.
- Painel do modo simulado (`web-painel-mock`) e `mockServiceWorker.js` são só de desenvolvimento (PEN-066).
- O axe do E2E deve passar a incluir as tags `wcag22aa` (inclui `target-size`); sugiro ao QA.
