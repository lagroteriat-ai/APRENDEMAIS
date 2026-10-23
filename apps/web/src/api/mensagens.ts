import type { CodigoCampo } from '@aprendemais/shared-types';
import type { ErroApi } from './cliente';

/* Catálogo pt-BR (único idioma por ora). A UI nunca mostra o `message` cru da API:
   escolhe o texto por `code` e, nos campos, por `details[].path` + `details[].code` (fluxos.md §9). */

export const MSG = {
  rede: 'Sem conexão. Confira sua internet e tente de novo.',
  interno: 'Algo deu errado. Tente de novo.',
  limite: 'Muitas tentativas. Espere alguns minutos e tente de novo.',
  semAcesso: 'Você não tem acesso a esta página.',
  desafio: 'Confirme que você não é um robô para continuar.',
  loginInvalido: 'Usuário ou senha incorretos.',
  camposParaCorrigir: 'Há campos para corrigir.',
  linkInvalido: 'Este link não funciona. Ele pode ter expirado ou já ter sido usado.',
  sessaoAcabou: 'Sua sessão acabou. Entre de novo.',
  apelidoEmUso: 'Esse apelido já existe. Vamos sortear outro.',
  esperePedirDeNovo: 'Espere um pouco para pedir de novo.',
} as const;

/** Mensagem para um erro sem campo associado. */
export function mensagemGeral(erro: ErroApi): string {
  switch (erro.code) {
    case 'REDE':
      return MSG.rede;
    case 'RATE_LIMITED':
      return MSG.limite;
    case 'FORBIDDEN':
    case 'NOT_FOUND':
      return MSG.semAcesso;
    case 'UNAUTHENTICATED':
      return MSG.sessaoAcabou;
    case 'DESAFIO_REQUERIDO':
      return MSG.desafio;
    case 'TOKEN_INVALIDO':
      return MSG.linkInvalido;
    case 'VALIDATION_ERROR':
      return MSG.camposParaCorrigir;
    default:
      return MSG.interno;
  }
}

const POR_CAMPO: Record<string, Partial<Record<CodigoCampo, string>>> = {
  identificador: { OBRIGATORIO: 'Escreva seu apelido ou e-mail.', FORMATO_INVALIDO: 'Escreva seu apelido ou e-mail.' },
  senha: {
    OBRIGATORIO: 'Escreva sua senha.',
    SENHA_CURTA: 'Use pelo menos 8 caracteres.',
    SENHA_LONGA: 'Use no máximo 128 caracteres.',
    SENHA_COMUM: 'Essa senha é muito comum. Escolha outra.',
    SENHA_IGUAL_APELIDO: 'A senha não pode ser igual ao apelido.',
  },
  novaSenha: {
    OBRIGATORIO: 'Escreva a nova senha.',
    SENHA_CURTA: 'Use pelo menos 8 caracteres.',
    SENHA_LONGA: 'Use no máximo 128 caracteres.',
    SENHA_COMUM: 'Essa senha é muito comum. Escolha outra.',
    SENHA_IGUAL_APELIDO: 'A senha não pode ser igual ao apelido.',
  },
  email: { OBRIGATORIO: 'Escreva um e-mail válido.', EMAIL_INVALIDO: 'Escreva um e-mail válido.', FORMATO_INVALIDO: 'Escreva um e-mail válido.', EMAIL_EM_USO: 'Já existe uma conta com este e-mail.' },
  nascimento: { OBRIGATORIO: 'Escolha o mês e o ano em que você nasceu.', NASCIMENTO_INVALIDO: 'Escolha o mês e o ano em que você nasceu.', FORMATO_INVALIDO: 'Escolha o mês e o ano em que você nasceu.' },
  anoEscolar: { OBRIGATORIO: 'Escolha o seu ano escolar.', ANO_ESCOLAR_INVALIDO: 'Escolha o seu ano escolar.', FORMATO_INVALIDO: 'Escolha o seu ano escolar.' },
  apelidoToken: { APELIDO_EM_USO: MSG.apelidoEmUso, APELIDO_INVALIDO: MSG.apelidoEmUso },
  aviso: { OBRIGATORIO: 'Marque para continuar.', AVISO_DESATUALIZADO: 'O aviso mudou. Leia de novo e marque para continuar.' },
  nomeResponsavel: { OBRIGATORIO: 'Escreva seu nome.', NOME_INVALIDO: 'Escreva seu nome (de 2 a 120 letras).' },
  declaracao: { OBRIGATORIO: 'Marque a caixa para autorizar.', DECLARACAO_OBRIGATORIA: 'Marque a caixa para autorizar.' },
  rankingAutorizado: { RANKING_INDISPONIVEL: 'O ranking ainda não está disponível.' },
};

/** Mensagem de um campo (`campo` = primeiro trecho de `details[].path`). */
export function mensagemCampo(campo: string, codigo: CodigoCampo): string {
  return POR_CAMPO[campo]?.[codigo] ?? 'Confira este campo.';
}

/** Converte `details` do servidor em `{ campo: mensagem }` (mantém só o 1º erro de cada campo). */
export function errosDeCampo(erro: ErroApi): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const d of erro.details) {
    const campo = d.path.split('.')[0] ?? d.path;
    saida[campo] ??= mensagemCampo(campo, d.code);
  }
  return saida;
}
