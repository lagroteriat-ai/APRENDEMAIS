import { NASCIMENTO_MAIOR, NASCIMENTO_MENOR, SENHA_TESTE, emailFicticio } from '@aprendemais/test-utils';
import { criarCliente } from '../api/cliente';
import { db } from '../mocks/banco';

export { SENHA_TESTE, emailFicticio };

/** Última "mensagem" enviada pela API simulada de um tipo (E1 autorização, E3 confirmação, E4 recuperação). */
export function ultimoLink(tipo: 'E1' | 'E3' | 'E4'): string {
  const e = [...db().emails].reverse().find((x) => x.tipo === tipo);
  if (!e) throw new Error(`Nenhum e-mail ${tipo} enviado`);
  return e.link;
}

/** Cadastra um aluno pela própria API simulada (sem passar pela tela) e devolve o que a tela precisaria. */
export async function cadastrarAlunoPelaApi({ maior = false, email = emailFicticio(maior ? 'aluno' : 'responsavel') } = {}) {
  const api = criarCliente();
  const sorteio = await api.chamar('sortearApelido');
  const avisos = await api.chamar('obterAvisosVigentes');
  if (!sorteio.ok || !avisos.ok) throw new Error('preparo do cadastro falhou');
  const r = await api.chamar('cadastrarAluno', {
    corpo: {
      apelidoToken: sorteio.data.apelidoToken,
      nascimento: maior ? NASCIMENTO_MAIOR : NASCIMENTO_MENOR,
      anoEscolar: maior ? 'EM3' : 'EF5',
      email,
      senha: SENHA_TESTE,
      aviso: { versao: avisos.data.aluno.versao },
    },
  });
  if (!r.ok) throw new Error(`cadastro falhou: ${r.code}`);
  return { apelido: sorteio.data.apelido, email, link: ultimoLink(maior ? 'E3' : 'E1') };
}

/** Entra pela API simulada (cria a sessão do banco simulado, como o cookie faria). */
export async function entrarPelaApi(identificador: string, senha: string) {
  const r = await criarCliente().chamar('entrar', { corpo: { identificador, senha } });
  if (!r.ok) throw new Error(`login falhou: ${r.code}`);
  return r.data;
}

/** Sai da sessão simulada (não há cookie no teste: o "banco" guarda a sessão). */
export async function sairPelaApi() {
  await criarCliente().chamar('sair');
}
