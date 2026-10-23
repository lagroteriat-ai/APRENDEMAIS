# Princípios de UX — Aprende+ (v1.0)

Dono: UX · Consumidores: FE, PED, QA · Complementa `fluxos.md` e `tokens.json`.

## 1. Tom de voz
Sempre pt-BR, frases curtas, voz ativa, uma ideia por frase. Falar **com** a pessoa (você), nunca "usuário". Sem ironia, sem culpa, sem comparar alunos. Erro é do sistema, não da pessoa.
| Etapa | Tom | Exemplo (erro de senha) |
|---|---|---|
| Fund. I (6–10) | Amigável, concreto, frases de até 8 palavras, emoji só como apoio ao texto | "Essa senha não deu certo. Vamos tentar de novo?" |
| Fund. II (11–14) | Direto e leve, sem infantilizar, gíria nenhuma | "Senha incorreta. Confira e tente de novo." |
| Médio (15–17) | Objetivo e respeitoso, foco em meta e progresso | "Senha incorreta. Esqueceu? Recupere seu acesso." |
| Professor / responsável | Profissional, claro, explica o porquê do dado pedido | "Pedimos este e-mail só para enviar a autorização." |
Telas públicas (login, cadastro) usam o tom neutro do Fund. II com vocabulário do Fund. I.

## 2. Acessibilidade (WCAG 2.2 AA — obrigatório)
- Contraste e alvos conforme `tokens.json` (texto 4.5:1, UI 3:1, alvo ≥ 44px).
- 100% operável por teclado, ordem de foco lógica, foco sempre visível, sem armadilha de teclado.
- Todo campo tem `<label>` visível; erro em texto + ícone (nunca só cor), ligado por `aria-describedby`; resumo de erros no topo com foco.
- Não depender de cor, som, tempo ou gesto: sem limite de tempo para preencher; alternativa a arrastar.
- Zoom de 200% e reflow a 320px sem rolagem horizontal; respeitar `prefers-reduced-motion`.
- Autenticação acessível (WCAG 3.3.8): permitir colar e gerenciador de senhas; sem teste cognitivo (captcha de enigma) — Turnstile sem desafio visual quando possível.
- Entrada redundante evitada (3.3.7): não pedir de novo o que já foi informado no fluxo.
- Leitores de tela: um `<h1>` por tela, landmarks (`header`, `nav`, `main`), mensagens dinâmicas em `aria-live="polite"`.

## 3. Mobile-first
- Desenhar em 360px primeiro; ampliar com `min-width` (breakpoints em `tokens.json`).
- Formulário em 1 coluna, máx. 440px; botão principal largo no mobile e fixo ao fim do conteúdo, nunca escondido pelo teclado.
- Teclado certo por campo (`inputmode`, `autocomplete`); mês/ano de nascimento em `select`, não em campo livre.
- Funcionar em rede lenta e aparelhos simples: sem animação pesada, estado de carregamento e de "sem conexão" em toda ação.

## 4. Gamificação saudável (vale para v0.2+; telas do Sprint 1 não têm ranking)
- **Progresso próprio primeiro:** destacar evolução do aluno contra ele mesmo; comparação é secundária.
- **Ranking é opt-in** (padrão desligado, exige responsável se < 18), só com apelido, por turma/escola; mostrar faixas ("top 10") em vez de posição exata quando possível; nunca "último lugar" nem lista de quem está embaixo.
- **Esforço vale:** pontos por tentar, revisar e melhorar, não só por acertar rápido; errar gera dica, nunca punição ou perda de pontos acumulados.
- **Sem pressão:** nada de contagem regressiva que gera ansiedade, sequência que pune faltas (streak sem "perdão"), notificações insistentes ou recompensas aleatórias tipo caça-níqueis.
- **Pausa e controle:** sempre dá para sair e voltar sem perder o que fez; lembrete de pausa em sessões longas; o aluno pode desligar sons, animações e ranking.
- **Sem manipulação:** sem publicidade, sem "compre/convide para ganhar", sem telas que escondem o botão de sair ou de recusar (RQ-08).
- **Inclusivo:** conquistas por metas pessoais e variadas, não só por velocidade; mídia/memes só curados (RQ-26..28).
