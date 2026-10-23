# Textos legais e de privacidade — Aprende+ (v1.0)

Dono: PED · Consumidores: FE (T04, T06, T07, T08), BE-02 (versionamento do consentimento), SEG, UX.
Base: `docs/seguranca/lgpd-requisitos.md` (RQ-xx) e `docs/ux/principios.md` (tom por etapa).

> **Não é aconselhamento jurídico.** Itens marcados **⚖ REVISÃO JURÍDICA** não podem ir a produção sem validação. Textos entre `[COLCHETES]` são lacunas a preencher antes da publicação (não inventar).

## 0. Resumo para quem implementa
| Documento | id | Versão | Onde aparece |
|---|---|---|---|
| Aviso de privacidade — responsáveis | `aviso-resp-v1` | 1.0 | link em T06 e nos e-mails; página `/privacidade/responsaveis` |
| Aviso para estudantes — EF1 / EF2 / EM | `aviso-aluno-ef1-v1`, `aviso-aluno-ef2-v1`, `aviso-aluno-em-v1` | 1.0 | T04 (conforme o ano escolar informado em T02) |
| Termo de consentimento parental | `consent-v1` | 1.0 | T06 |
| E-mails E1–E4 | `email-e1-v1` … `email-e4-v1` | 1.0 | envio pela API |

Placeholders globais: `{{controlador}}` = [RAZÃO SOCIAL/CNPJ DO CONTROLADOR — a definir] ⚖ · `{{canal_privacidade}}` = [E-MAIL DEDICADO — a definir] · `{{encarregado}}` = [NOME/CONTATO DO ENCARREGADO (DPO) — a definir] ⚖ · `{{apelido}}` · `{{data}}` · `{{link}}`.

---

## 1. Aviso de privacidade — para responsáveis (`aviso-resp-v1`)
*Tom: profissional e claro, explica o porquê de cada dado (principios.md §1). Leitura ≤ 3 minutos.*

### Aviso de privacidade do Aprende+ — responsáveis
**Versão 1.0 · vigente desde [DATA DE PUBLICAÇÃO]**

**1. Quem somos.** O Aprende+ é uma plataforma de atividades educativas para estudantes do Ensino Fundamental e Médio. O responsável pelos dados é {{controlador}}. Em uso por escola, a relação entre escola e Aprende+ pode ser diferente (ver item 10). ⚖ (RQ-10)

**2. Por que pedimos a sua autorização.** A lei brasileira (LGPD, art. 14) exige que o tratamento de dados de crianças e adolescentes seja feito no melhor interesse deles e, para menores de 18 anos, com autorização específica de um responsável. ⚖ (RQ-02, idade-limite)

**3. Quais dados guardamos e para quê**
| Dado | Para que serve |
|---|---|
| Apelido (gerado pela plataforma) | Identificar o estudante e permitir o acesso |
| Mês e ano de nascimento | Saber se precisa de autorização e adequar o conteúdo |
| Ano escolar | Mostrar atividades da série certa |
| Senha (guardada de forma protegida, nunca em texto) | Proteger a conta |
| Progresso, respostas e pontuação nas atividades | Mostrar a evolução do estudante e ajudar o professor |
| Seu nome e e-mail (responsável) | Pedir, registrar e permitir mudar a autorização |
| Turma/escola/município, **se** o estudante usar a plataforma por uma escola | Ligar o estudante à turma do professor |

**4. O que NÃO fazemos.** Não pedimos CPF, RG, endereço, telefone, foto, localização ou dados sensíveis (saúde, religião etc.). Não mostramos anúncios. Não vendemos nem compartilhamos dados para fins comerciais. Não usamos login de redes sociais nem rastreadores de terceiros nas telas do estudante. (RQ-08, RQ-12, RQ-13)

**5. Quem vê os dados.** O estudante vê os próprios dados. Você vê os dados do estudante que autorizou. O professor vê o progresso dos alunos das suas turmas. A gestão da escola vê dados agregados e o status da autorização. A equipe técnica acessa só o necessário, com registro de acesso. Operamos em infraestrutura de nuvem da Cloudflare, que pode processar dados fora do Brasil. ⚖ (PEN-017, LGPD art. 33: base da transferência internacional)

**6. Ranking (opcional).** Se existir na plataforma e você marcar a opção, o **apelido** do estudante aparece em rankings da turma ou da escola, nunca com nome, foto ou idade. Está desligado por padrão e você pode desligar quando quiser. (RQ-21..23)

**7. Por quanto tempo guardamos.** Enquanto a conta estiver ativa. Se você não responder ao pedido de autorização em **7 dias**, apagamos o cadastro do estudante e o seu e-mail. Contas sem uso por [12 meses] são avisadas e depois apagadas ou anonimizadas em até [30 dias]. ⚖ (RQ-05, RQ-19: prazos finais)

**8. Seus direitos.** Você pode, a qualquer momento: saber o que guardamos, corrigir dados, receber uma cópia, **retirar a autorização** e pedir a **exclusão** dos dados do estudante. Retirar a autorização é tão fácil quanto concedê-la: use o link "Gerenciar autorização" do e-mail que enviamos. Atendemos pedidos em até **15 dias**. ⚖ (RQ-07, RQ-14..17: prazos)

**9. Segurança.** Usamos conexão protegida, senhas guardadas de forma segura, controle de acesso por papel e registro de acessos. Em caso de incidente que possa afetar você, avisaremos você e a Autoridade Nacional de Proteção de Dados (ANPD) conforme a lei. ⚖ (RQ-33)

**10. Uso por escolas.** Quando a escola contrata ou indica o Aprende+, [DEFINIR: a escola é controladora e o Aprende+ operador, e a escola/o Aprende+ coleta a autorização do responsável]. ⚖ (RQ-10, PEN-012)

**11. Fale com a gente.** Canal de privacidade: {{canal_privacidade}}. Encarregado pelo tratamento de dados: {{encarregado}}. ⚖ (RQ-18, PEN-013)

**12. Mudanças.** Se este aviso mudar de forma relevante, pediremos uma nova autorização. Versões anteriores ficam registradas junto à sua autorização.

---

## 2. Aviso para estudantes (`aviso-aluno-*-v1`)
Exibido em T04 como bloco curto + "Ler aviso completo". O texto da faixa vem do **ano escolar** informado em T02 (1º–5º → EF1; 6º–9º → EF2; 1ª–3ª série → EM). Todas as versões dizem a mesma coisa que o aviso dos responsáveis, em linguagem adequada (RQ-06). ⚖ revisão jurídica de que as versões simplificadas não contradizem o aviso integral.

### 2.1 EF1 (1º–5º ano) — `aviso-aluno-ef1-v1`
*Frases de até 8 palavras; emoji só como apoio; leitura por um adulto é bem-vinda.*

**O que o Aprende+ guarda sobre você** 📘
- Seu apelido, como **LeaoAzul42**.
- O mês e o ano em que você nasceu.
- Seu ano na escola.
- Suas respostas e seus pontos nas atividades.

**O que a gente NÃO faz**
- Não pedimos seu endereço, sua foto ou seu CPF.
- Não mostramos anúncios.
- Não passamos seus dados para ninguém vender.

**Quem pode ver?** Você, a pessoa responsável por você e seu professor.

**Importante:** um adulto responsável precisa dizer "sim" para você entrar. Peça ajuda a ele para ler isto junto com você.

Se tiver dúvida ou algo parecer estranho, **conte para um adulto**.

### 2.2 EF2 (6º–9º ano) — `aviso-aluno-ef2-v1`
*Direto e leve, sem infantilizar.*

**Como cuidamos dos seus dados**
- **O que guardamos:** apelido, mês e ano de nascimento, ano escolar, senha (protegida) e seu progresso e pontuação nas atividades.
- **Para quê:** liberar seu acesso, mostrar atividades do seu ano e acompanhar sua evolução.
- **O que não pedimos:** nome completo, endereço, foto, telefone, localização ou CPF.
- **Anúncios e venda de dados:** não temos e não fazemos.
- **Quem vê:** você, seu responsável e seus professores. A escola vê dados em grupo.
- **Autorização:** como você tem menos de 18 anos, seu responsável precisa autorizar o uso. Enquanto isso não acontece, você não consegue entrar.
- **Seus direitos:** você ou seu responsável podem pedir para ver, corrigir ou apagar seus dados. Se você pedir, avisamos seu responsável.
- **Ranking:** é opcional, desligado por padrão e só mostra seu apelido.

Dúvidas: {{canal_privacidade}}.

### 2.3 EM (1ª–3ª série) — `aviso-aluno-em-v1`
*Objetivo e respeitoso, foco em controle sobre os próprios dados.*

**Seus dados no Aprende+**
- **Coletamos o mínimo:** apelido, mês/ano de nascimento, série, senha (armazenada de forma protegida) e seu desempenho nas atividades. Não coletamos CPF, endereço, foto, localização nem dados sensíveis.
- **Finalidade única:** uso educacional da plataforma. Sem publicidade, sem perfilamento comercial, sem venda ou compartilhamento com terceiros para fins comerciais.
- **Menores de 18 anos:** a LGPD exige autorização de um responsável. Ela é pedida por e-mail, sem documentos, e o cadastro não autorizado em 7 dias é apagado. ⚖ (RQ-02, RQ-04)
- **Visibilidade:** seus professores veem seu progresso; sua escola vê dados agregados. Seu apelido só aparece em ranking se você e seu responsável optarem.
- **Controle:** você pode pedir acesso, correção, cópia e exclusão dos seus dados em até 15 dias, e pode desligar o ranking quando quiser. O responsável pode retirar a autorização a qualquer momento.
- **Contato:** {{canal_privacidade}} · Encarregado: {{encarregado}}.

Observação para BE/SEG: para 16–17 anos o consentimento parental segue exigido (padrão conservador, RQ-02) até o jurídico decidir diferente. ⚖

---

## 3. Termo de consentimento parental (`consent-v1`)
Exibido em T06 (e arquivado como texto exato aceito). **Qualquer alteração de texto = novo id (`consent-v2`) e nova autorização.**

### 3.1 Texto do termo
> **Autorização para o uso do Aprende+ por {{apelido}}**
>
> Eu, **{{nome_responsavel}}**, declaro que sou o(a) responsável legal por **{{apelido}}** e **autorizo**, de forma específica e em destaque, que o Aprende+ ({{controlador}}) trate os seguintes dados do(a) estudante para uso educacional da plataforma: apelido, mês e ano de nascimento, ano escolar, senha (protegida) e progresso, respostas e pontuação nas atividades.
>
> Entendo que: (1) o Aprende+ não pede CPF, endereço, foto nem localização, não exibe anúncios e não vende nem compartilha os dados para fins comerciais; (2) posso **retirar esta autorização a qualquer momento** pelo link "Gerenciar autorização" enviado ao meu e-mail, e os dados serão excluídos em até 15 dias; (3) li o Aviso de privacidade para responsáveis (`aviso-resp-v1`); (4) o cadastro é apagado se eu não responder em 7 dias.
>
> *Ranking (opcional, separado):* **Autorizo** que o apelido de {{apelido}}, sem nome nem foto, apareça no ranking da turma e da escola. (Desmarcado por padrão. Não é necessário para usar o Aprende+.)

### 3.2 Elementos de interface (para FE)
- Caixa obrigatória: "Sou responsável por {{apelido}} e autorizo o uso desses dados." + campo "Seu nome". Botões "Autorizar" e "Não autorizar" com mesmo peso visual (RQ-08).
- Caixa do ranking **separada**, desmarcada, e **oculta no Sprint 1** (recurso inexistente); quando existir, é nova versão do termo (`consent-v2`).

### 3.3 Registro e versionamento (para BE-02/DAD)
Gravar por consentimento: `consent_id` (`consent-v1`), `texto_hash` (SHA-256 do texto exato exibido), `aviso_id` (`aviso-resp-v1`), `aluno_id`, `nome_responsavel`, `email_responsavel` (ou hash, a definir ⚖), `acao` (`autorizado`/`recusado`/`revogado`), `ranking_optin` (bool), `data_hora_utc`, `ip_truncado`/hash (RQ-30). Textos publicados em `docs/pedagogia/versoes/consent-v1.md` (imutável; mudanças viram nova versão). Revogação cria novo registro, não apaga o anterior (prova do consentimento; ⚖ confirmar retenção do registro após exclusão).

Pontos ⚖ do termo: suficiência de "caixa + nome + e-mail" como consentimento específico/esforço razoável (RQ-04, art. 14 §5); validade para adolescentes; guardar nome/e-mail do responsável após exclusão; ranking como finalidade separada.

---

## 4. E-mails do fluxo (E1–E4)
Regras (fluxos.md §10): texto simples + HTML mínimo, sem imagens de rastreamento, sem PII no assunto além do apelido, link único e visível em texto puro. Remetente: "Aprende+" `<[REMETENTE A DEFINIR]>`. Rodapé comum (`{{rodape}}`):
> Você recebeu este e-mail porque este endereço foi informado no Aprende+. Se não foi você, ignore esta mensagem: nada será feito sem o seu clique. Dúvidas: {{canal_privacidade}}.

### E1 — Responsável: autorizar (`email-e1-v1`)
**Assunto:** Autorize o uso do Aprende+ por {{apelido}}
**Corpo:**
> Olá!
>
> Alguém criou uma conta no Aprende+ com o apelido **{{apelido}}** e informou este e-mail como o do responsável. Por lei, estudantes menores de 18 anos só podem usar a plataforma com a autorização de um responsável.
>
> O Aprende+ é uma plataforma de atividades educativas. Guardamos apenas apelido, mês e ano de nascimento, ano escolar e o progresso nas atividades. Não pedimos CPF, endereço ou foto, não mostramos anúncios e não vendemos dados.
>
> **[Ver e decidir]** {{link}}
>
> Você pode autorizar ou recusar. O link vale por **7 dias** e só pode ser usado uma vez. Se você não responder ou recusar, apagamos o cadastro e este e-mail.
>
> Se você não conhece essa pessoa ou não esperava esta mensagem, ignore-a ou recuse pelo link.
>
> {{rodape}}

### E2 — Responsável: autorização registrada (`email-e2-v1`)
**Assunto:** Autorização registrada para {{apelido}}
**Corpo:**
> Olá!
>
> Registramos em {{data}} a sua autorização para o uso do Aprende+ por **{{apelido}}**. Ele(a) já pode entrar.
>
> Guarde este e-mail: o link abaixo permite ver a autorização e **retirá-la quando quiser**, sem precisar de senha. Se retirar, os dados são excluídos em até 15 dias.
>
> **[Gerenciar autorização]** {{link}}
>
> Termo aceito: `consent-v1` · Aviso de privacidade: `aviso-resp-v1`.
>
> Não compartilhe este e-mail: quem tiver o link pode gerenciar a autorização.
>
> {{rodape}}

### E3 — Aluno 18+ / professor: confirmar e-mail (`email-e3-v1`)
**Assunto:** Confirme seu e-mail no Aprende+
**Corpo:**
> Olá!
>
> Falta pouco para você começar no Aprende+. Confirme que este e-mail é seu:
>
> **[Confirmar e-mail]** {{link}}
>
> O link vale por [PRAZO A DEFINIR (BE-02)] e só pode ser usado uma vez. Se o link expirar, peça um novo na tela de entrada.
>
> Ao confirmar, você concorda com o Aviso de privacidade (`aviso-aluno-em-v1` ou o de professores [A REDIGIR ⚖ RQ-09]).
>
> {{rodape}}

### E4 — Recuperação de senha (`email-e4-v1`)
Duas variantes (DU-03): conta de menor vai ao responsável.
**Assunto:** Crie uma nova senha no Aprende+
**Corpo (conta de adulto):**
> Olá!
>
> Recebemos um pedido para criar uma nova senha da sua conta no Aprende+.
>
> **[Criar nova senha]** {{link}}
>
> O link vale por [PRAZO A DEFINIR (SEG)] e só pode ser usado uma vez. Se não foi você, ignore este e-mail: sua senha continua a mesma.
>
> {{rodape}}

**Corpo (conta de menor, enviado ao responsável):**
> Olá!
>
> Recebemos um pedido para criar uma nova senha para a conta **{{apelido}}**, e este e-mail é o do responsável. Para a segurança do estudante, é você quem define a nova senha, com ele(a) ao seu lado.
>
> **[Criar nova senha]** {{link}}
>
> O link vale por [PRAZO A DEFINIR (SEG)] e só pode ser usado uma vez. Se ninguém pediu, ignore este e-mail: a senha continua a mesma.
>
> {{rodape}}

Revisão ⚖/SEG: não revelar a existência de conta (DU-06) — a tela de pedido sempre responde "Se existir uma conta, enviamos o link"; o e-mail só é enviado se a conta existe.

---

## 5. Frases de tela T06/T07/T08 (complemento ao UX-02)
| Tela | Texto |
|---|---|
| T06 título | "{{apelido}} quer usar o Aprende+" · "Precisamos da sua autorização." |
| T06 ajuda do botão desabilitado | "Marque a caixa e escreva seu nome para autorizar." |
| T07 autorizado | "Tudo certo! {{apelido}} já pode entrar. Enviamos um e-mail com o link para você mudar de ideia quando quiser." |
| T07 recusado | "Tudo bem. Apagamos o cadastro de {{apelido}} e este e-mail. Nenhum dado foi guardado." (`recusado`: gravar só o necessário para não reenviar? ⚖) |
| T07 link inválido | "Este link não funciona. Ele pode ter expirado ou já ter sido usado. O cadastro não autorizado em 7 dias é apagado. Peça para o estudante criar a conta de novo." |
| T08 retirar | "Ao retirar a autorização, {{apelido}} perde o acesso e os dados serão excluídos em até 15 dias. Essa ação não pode ser desfeita." · botão "Retirar autorização" · confirmação "Sim, retirar" / "Voltar" |

---

## 6. Resposta à PEN-009 (página/aviso de privacidade e exclusão na landing)
**Situação verificada:** a landing atual (`index.html`/`script.js`, `functions/api/leads.js`) coleta nome, sobrenome, e-mail, telefone, perfil e um booleano de "consentimento", **sem** idade, sem consentimento parental e **sem página de privacidade nem fluxo de exclusão confirmados** (lgpd-requisitos §1). Não li o HTML da landing nesta tarefa; confirmar visualmente com FE.

**Resposta / encaminhamento:**
1. **Não existe base para dizer que há aviso e fluxo de exclusão.** Tratar PEN-009 como *confirmada: ausente* até FE/SEG provarem o contrário.
2. **Aviso mínimo para a landing** (texto proposto, ⚖): reaproveitar o aviso da §1 reduzido aos dados de lead (nome, sobrenome, e-mail, telefone, perfil; finalidade: contato e acesso ao protótipo; sem venda; direitos e canal `{{canal_privacidade}}`; retenção [PRAZO ⚖]), publicado em `/privacidade` e linkado ao lado da caixa de consentimento do formulário.
3. **Exclusão:** até existir autoatendimento, o canal `{{canal_privacidade}}` atende pedidos de exclusão/correção em até 15 dias (RQ-14), com protocolo (RQ-18). O painel admin já exclui lead (`DELETE /api/admin/leads`); o procedimento operacional deve ser documentado por SEG/DEV.
4. **Menores na landing:** como não há idade nem consentimento parental, **recomendação: não captar menores nesse formulário** (avisar "para responsáveis e professores" ou pedir idade) até alinhar a RQ-01..RQ-08. Leads já captados: PEN-014 (reconsentir, anonimizar ou excluir). ⚖
5. Pendências abertas pelo PED: redigir aviso de professores/gestores (RQ-09), textos finais após jurídico, preencher placeholders.

## 7. Checklist ⚖ (consolidado)
1. Idade-limite e consentimento para 12–17 (§2.3, §3) — PEN-011.
2. Suficiência do consentimento por e-mail/caixa/nome e prazo de 7 dias — PEN-011.
3. Papel da escola e quem coleta o consentimento (§1 item 10) — PEN-012.
4. Encarregado (DPO), canal, aviso final e RIPD (§1 item 11) — PEN-013.
5. Transferência internacional (Cloudflare) e menção no aviso — PEN-017.
6. Retenção: prazos de 12 meses/30 dias/15 dias; retenção do registro de consentimento após exclusão.
7. ECA Digital (Lei 15.211/2025): exigências adicionais de linguagem, verificação etária e controles parentais.
8. Aviso mínimo da landing e destino dos leads antigos — PEN-009/PEN-014.
9. Aviso para professores/gestores (RQ-09), ainda não redigido.
10. Equivalência jurídica entre as versões simplificadas (EF1/EF2/EM) e o aviso integral.
