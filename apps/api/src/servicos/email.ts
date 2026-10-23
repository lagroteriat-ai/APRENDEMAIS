import type { Env } from '../env';
import type { MensagemEmail } from '../tipos';

// Textos PROVISÓRIOS de E1–E4 e E6 (fluxos.md §10). PED-02 entrega o conteúdo final; manter: texto simples,
// sem imagens de rastreamento, sem PII no assunto além do apelido, link legível também em texto puro.

function base(env: Env): string {
  return env.APP_BASE_URL.replace(/\/+$/, '');
}

export function linkConsentimento(env: Env, token: string): string {
  return `${base(env)}/responsavel/autorizar?t=${token}`;
}
export function linkGerenciar(env: Env, token: string): string {
  return `${base(env)}/responsavel/gerenciar?t=${token}`;
}
export function linkRecuperacao(env: Env, token: string): string {
  return `${base(env)}/recuperar/nova?t=${token}`;
}
export function linkConfirmacao(env: Env, token: string): string {
  return `${base(env)}/confirmar-email?t=${token}`;
}

export function emailE1(para: string, apelido: string, link: string): MensagemEmail {
  return {
    para, tipo: 'E1', link,
    assunto: `Autorize o uso do Aprende+ por ${apelido}`,
    texto: `Alguém pediu para usar o Aprende+ com o apelido ${apelido} e precisa da sua autorização.\n\nVer e decidir: ${link}\n\nO pedido vale por 7 dias. Se você não reconhece este pedido, ignore este e-mail: nada será guardado.`
  };
}

export function emailE2(para: string, apelido: string, link: string): MensagemEmail {
  return {
    para, tipo: 'E2', link,
    assunto: 'Autorização registrada',
    texto: `Você autorizou o uso do Aprende+ por ${apelido}.\n\nPara mudar de ideia quando quiser: ${link}`
  };
}

export function emailE3(para: string, link: string): MensagemEmail {
  return {
    para, tipo: 'E3', link,
    assunto: 'Confirme seu e-mail',
    texto: `Confirme seu e-mail para ativar sua conta no Aprende+: ${link}\n\nO link vale por 7 dias.`
  };
}

export function emailE4(para: string, link: string): MensagemEmail {
  return {
    para, tipo: 'E4', link,
    assunto: 'Crie uma nova senha',
    texto: `Recebemos um pedido para criar uma nova senha no Aprende+: ${link}\n\nO link vale por 30 minutos e só pode ser usado uma vez. Se não foi você, ignore este e-mail.`
  };
}

/** Aviso ao dono de um e-mail que já tem conta (DC-05): o cadastro novo não revela nada ao visitante. */
export function emailE6(para: string, link: string): MensagemEmail {
  return {
    para, tipo: 'E6', link,
    assunto: 'Você já tem conta no Aprende+',
    texto: `Alguém tentou criar uma conta no Aprende+ com este e-mail, mas você já tem uma.\n\nSe foi você e esqueceu a senha: ${link}\n\nSe não foi você, ignore este e-mail.`
  };
}
