# @aprendemais/ui — design system

Componentes React + tokens CSS (`--am-*`) do Aprende+. Fonte dos valores: `docs/ux/tokens.json` (dono: UX). Acessibilidade WCAG 2.2 AA, mobile-first (360px), textos em pt-BR.

## Usar no app
```tsx
// apps/web/src/main.tsx — uma vez (já feito)
import '@aprendemais/ui/styles.css';

import { Button, FormField, Input } from '@aprendemais/ui';

<FormField label="Usuário ou e-mail" required error={erro}>
  <Input autoComplete="username" />
</FormField>
<Button type="submit" loading={enviando} loadingText="Entrando…">Entrar</Button>
```
O pacote é consumido pelo código-fonte (sem build). Em `package.json` do app: `"@aprendemais/ui": "workspace:*"`.

## Componentes
| Componente | Pontos de atenção |
|---|---|
| `Button` | `variant`: primary · accent · secondary · danger · link; `size`: sm (36px) · md (44px) · lg (52px); `fullWidth`; `loading` + `loadingText` (mantém o foco, `aria-busy`, ignora cliques). `type` padrão é `"button"`: use `type="submit"` no envio. |
| `FormField` | Rótulo visível + `help` + `error` (ícone + texto) + `required`/`optional` (em texto). Liga `htmlFor` e `aria-describedby`; `Input` e `Select` dentro dele herdam id, `aria-invalid` e `aria-required`. |
| `Input` | Props nativas (`type`, `inputMode`, `autoComplete`…); `invalid`; `endAction` para ações ao lado (ex.: "Mostrar" senha). |
| `Select` | `<select>` nativo estilizado; `placeholder` vira a 1ª `<option value="">`. |
| `Checkbox` | `label` (aceita link), `help`, `error`; área clicável ≥ 44px. Não usa `FormField` (tem rótulo próprio). |
| `Card` | `as` (div/section/article/li), `title` + `headingLevel`, `tone="tint"`, `footer`. Em `section`/`article` o título nomeia a região. |
| `Alert` | `variant` info · success · warning · error. Erro = `role="alert"`; demais = `role="status"`. Para resumo de erros: `ref` + `tabIndex={-1}` e `ref.current.focus()`. |
| `Modal` | `<dialog>` nativo (foco preso, Esc, fundo inerte, foco volta a quem abriu). Controlado: `open` + `onClose`. `initialFocusRef` (padrão: o título; em confirmação destrutiva aponte para "Voltar"). |
| `Container` · `Stack` · `Grid` · `AppShell` | `Container size="default\|content\|form"`; `Stack gap direction`; `Grid columns={1\|2\|3}` (1 → 2 em ≥768px → 3 em ≥1024px); `AppShell` = link "Ir para o conteúdo" + `header`/`main`/`footer` + `etapa` (`data-etapa`). |

## Regras
- **Formulários:** use `<form noValidate>`; valide em JS e mostre `error` nos campos + resumo com `Alert` (ver `docs/ux/fluxos.md` §9). `required` do `FormField` só marca `aria-required` (não ativa o balão nativo).
- **Etapa de ensino:** `<AppShell etapa="fund1">` (área logada do aluno) aumenta fonte (18px), alvos (48px) e raios; telas públicas usam `neutra` (padrão).
- **Fundo escuro:** adicione a classe `am-on-dark` no contêiner para o anel de foco amarelo.
- **Cores:** nunca use `--am-color-brand-yellow` como texto/ícone/borda sobre branco (1,81:1); veja `contraste` em `tokens.json`.
- **Sem animação:** `prefers-reduced-motion` já é respeitado em `base.css`.
- `Icon` (info, success, warning, error, chevron-down, close) é exportado para quem monta mensagens de erro próprias: sempre decorativo (`aria-hidden`), acompanhe de texto.
- Não há `CardLink`/menu/toast/tabela ainda: peça ao FE (novo item) antes de criar variações dentro de `apps/web`.

## Tokens
`src/styles/tokens.css` é **gerado**. Mudou `docs/ux/tokens.json`? Rode `pnpm --filter @aprendemais/ui tokens`. O teste `tokens.test.ts` falha se estiver desatualizado e recalcula todos os pares de contraste do JSON.

## Scripts (`pnpm --filter @aprendemais/ui …`)
`playground` (abre `/playground/` com todos os componentes e estados) · `test` · `typecheck` · `tokens` · `tokens:check` · `build` (tokens:check + tsc + build da página de exemplo em `dist/`).

## Limites dos testes
Vitest + jsdom + axe (sem `color-contrast`, que é coberto em `tokens.test.ts`). O `<dialog>` é simulado no jsdom: foco preso e Esc reais só existem em navegador — o E2E (QA) deve cobrir.
