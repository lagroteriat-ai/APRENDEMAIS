import {
  SENHA_MAX,
  SENHA_MIN,
  anoEscolarSchema,
  emailEntradaSchema,
  nascimentoSchema,
} from '@aprendemais/shared-types';
import { mensagemCampo } from '../api/mensagens';

/* Validação do cliente: só espelha as regras de formato do contrato (shared-types) para avisar
   cedo. Quem decide é o servidor (lista de senhas comuns, apelido em uso, idade etc.). Cada
   função devolve a mensagem de erro, ou `undefined` se o valor passa. */

export function validarEmail(valor: string): string | undefined {
  return emailEntradaSchema.safeParse(valor).success ? undefined : mensagemCampo('email', 'EMAIL_INVALIDO');
}

export function validarSenhaNova(valor: string, campo: 'senha' | 'novaSenha' = 'senha'): string | undefined {
  if (valor.length === 0) return mensagemCampo(campo, 'OBRIGATORIO');
  if (valor.length < SENHA_MIN) return mensagemCampo(campo, 'SENHA_CURTA');
  if (valor.length > SENHA_MAX) return mensagemCampo(campo, 'SENHA_LONGA');
  return undefined;
}

/** Senha do login: só exige algo digitado (regras de senha valem na criação, não na entrada). */
export function validarSenhaLogin(valor: string): string | undefined {
  return valor.length === 0 || valor.length > SENHA_MAX ? mensagemCampo('senha', 'OBRIGATORIO') : undefined;
}

export function validarIdentificador(valor: string): string | undefined {
  const v = valor.trim();
  return v.length >= 3 && v.length <= 254 ? undefined : mensagemCampo('identificador', 'OBRIGATORIO');
}

/** `mes` "01".."12" e `ano` "2014"; vazio = não escolhido. */
export function validarNascimento(mes: string, ano: string): string | undefined {
  return nascimentoSchema.safeParse(`${ano}-${mes}`).success
    ? undefined
    : mensagemCampo('nascimento', 'NASCIMENTO_INVALIDO');
}

export function validarAnoEscolar(valor: string): string | undefined {
  return anoEscolarSchema.safeParse(valor).success ? undefined : mensagemCampo('anoEscolar', 'ANO_ESCOLAR_INVALIDO');
}

export function validarNome(valor: string): string | undefined {
  const n = valor.trim().length;
  return n >= 2 && n <= 120 ? undefined : mensagemCampo('nomeResponsavel', 'NOME_INVALIDO');
}
