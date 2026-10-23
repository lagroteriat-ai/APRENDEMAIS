import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { db } from '../../mocks/banco';
import { servidor } from '../../mocks/servidor';
import { SENHA_TESTE, emailFicticio } from '../../testes/apoio';
import { esperarSemViolacoes, renderizarApp } from '../../testes/renderizar';

type Usuario = ReturnType<typeof renderizarApp>['usuario'];

async function passo1(usuario: Usuario, { mes = 'Maio', ano = '2014', serie = '5º ano do Fundamental' } = {}) {
  await usuario.selectOptions(screen.getByLabelText('Mês'), mes);
  await usuario.selectOptions(screen.getByLabelText('Ano'), ano);
  await usuario.selectOptions(screen.getByLabelText('Em que ano você estuda?'), serie);
  await usuario.click(screen.getByRole('button', { name: 'Continuar' }));
}

async function passo2(usuario: Usuario, email: string, rotulo: RegExp = /E-mail/) {
  await usuario.type(screen.getByLabelText(rotulo), email);
  await usuario.click(screen.getByRole('button', { name: 'Continuar' }));
}

async function passo3(usuario: Usuario, senha = SENHA_TESTE, aviso = true) {
  await usuario.type(screen.getByLabelText(/^Senha/), senha);
  if (aviso) await usuario.click(screen.getByRole('checkbox', { name: /Li o aviso de privacidade/ }));
  await usuario.click(screen.getByRole('button', { name: 'Criar minha conta' }));
}

async function abrir() {
  const r = renderizarApp('/cadastro');
  await screen.findByRole('heading', { name: 'Sobre você' });
  return r;
}

describe('T02–T04 · Cadastro de aluno', () => {
  it('passo 1: apelido sorteado, selects nativos e nenhum campo livre de nome', async () => {
    const { container } = await abrir();
    expect(screen.getByText('Passo 1 de 3')).toBeInTheDocument();
    const apelido = screen.getByLabelText('Seu apelido') as HTMLInputElement;
    expect(apelido.value).toMatch(/^[A-Za-z]+\d{2,3}$/);
    expect(apelido).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Mês').tagName).toBe('SELECT');
    await esperarSemViolacoes(container);
  });

  it('"Sortear outro" troca o apelido e anuncia', async () => {
    const { usuario } = await abrir();
    const antes = (screen.getByLabelText('Seu apelido') as HTMLInputElement).value;
    await usuario.click(screen.getByRole('button', { name: 'Sortear outro' }));
    await screen.findByText(/Seu novo apelido é/);
    expect((screen.getByLabelText('Seu apelido') as HTMLInputElement).value).not.toBe(antes);
  });

  it('passo 1 sem escolher nada: mostra os erros e não avança', async () => {
    const { usuario } = await abrir();
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }));
    const resumo = screen.getByRole('alert');
    expect(resumo).toHaveFocus();
    expect(resumo).toHaveTextContent('Escolha o mês e o ano em que você nasceu.');
    expect(resumo).toHaveTextContent('Escolha o seu ano escolar.');
    expect(screen.getByRole('heading', { name: 'Sobre você' })).toBeInTheDocument();
  });

  it('menor de 18: pede o e-mail do RESPONSÁVEL e termina na espera de autorização', async () => {
    const { usuario } = await abrir();
    const apelido = (screen.getByLabelText('Seu apelido') as HTMLInputElement).value;
    await passo1(usuario);

    expect(await screen.findByRole('heading', { name: 'Seu responsável' })).toBeInTheDocument();
    expect(screen.getByText('Passo 2 de 3')).toBeInTheDocument();
    const email = emailFicticio('responsavel');
    await passo2(usuario, email, /E-mail do responsável/);

    expect(await screen.findByRole('heading', { name: 'Crie sua senha' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Senha/)).toHaveAttribute('autocomplete', 'new-password');
    await passo3(usuario);

    expect(await screen.findByRole('heading', { name: 'Falta pouco!' })).toBeInTheDocument();
    expect(screen.getByTestId('local')).toHaveTextContent('/cadastro/aguardando');
    expect(await screen.findByText(apelido)).toBeInTheDocument(); // vem de GET /me, depois do "Carregando…"
    expect(db().usuarios.find((u) => u.apelido === apelido)).toMatchObject({ status: 'pendente_responsavel', emailResponsavel: email });
  });

  it('18 anos ou mais: pede o PRÓPRIO e-mail e pede para confirmar', async () => {
    const { usuario } = await abrir();
    await passo1(usuario, { mes: 'Março', ano: '2000', serie: '3ª série do Médio' });
    expect(await screen.findByRole('heading', { name: 'Seu e-mail' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^E-mail/)).toHaveAttribute('autocomplete', 'email');
    await passo2(usuario, emailFicticio('aluno'));
    await passo3(usuario);
    expect(await screen.findByRole('heading', { name: 'Confirme seu e-mail' })).toBeInTheDocument();
  });

  it('e-mail inválido no passo 2 é barrado no cliente', async () => {
    const { usuario } = await abrir();
    await passo1(usuario);
    await screen.findByRole('heading', { name: 'Seu responsável' });
    await passo2(usuario, 'maria@');
    expect(screen.getByRole('alert')).toHaveTextContent('Escreva um e-mail válido.');
    expect(screen.getByLabelText(/E-mail do responsável/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('voltar mantém o que já foi preenchido (na memória)', async () => {
    const { usuario } = await abrir();
    await passo1(usuario);
    await screen.findByRole('heading', { name: 'Seu responsável' });
    await usuario.click(screen.getByRole('button', { name: /Criar conta/ }));
    expect(await screen.findByRole('heading', { name: 'Sobre você' })).toBeInTheDocument();
    expect(screen.getByLabelText('Ano')).toHaveValue('2014');
  });

  it('o título recebe o foco a cada passo (leitor de tela percebe a troca)', async () => {
    const { usuario } = await abrir();
    await passo1(usuario);
    expect(await screen.findByRole('heading', { name: 'Seu responsável' })).toHaveFocus();
  });

  it('senha curta e aviso sem marcar: erros no passo 3, sem chamar a API', async () => {
    let chamadas = 0;
    servidor.use(http.post('*/api/v1/cadastro/aluno', () => (chamadas++, HttpResponse.json({}, { status: 500 }))));
    const { usuario } = await abrir();
    await passo1(usuario);
    await screen.findByRole('heading', { name: 'Seu responsável' });
    await passo2(usuario, emailFicticio('responsavel'), /E-mail do responsável/);
    await screen.findByRole('heading', { name: 'Crie sua senha' });
    await passo3(usuario, 'curta', false);
    const resumo = screen.getByRole('alert');
    expect(resumo).toHaveTextContent('Use pelo menos 8 caracteres.');
    expect(resumo).toHaveTextContent('Marque para continuar.');
    expect(chamadas).toBe(0);
  });

  it('"Sugerir uma senha fácil" preenche 3 palavras e deixa a senha visível', async () => {
    const { usuario } = await abrir();
    await passo1(usuario);
    await screen.findByRole('heading', { name: 'Seu responsável' });
    await passo2(usuario, emailFicticio('responsavel'), /E-mail do responsável/);
    await screen.findByRole('heading', { name: 'Crie sua senha' });
    await usuario.click(screen.getByRole('button', { name: 'Sugerir uma senha fácil' }));
    const campo = screen.getByLabelText(/^Senha/) as HTMLInputElement;
    expect(campo.value).toMatch(/^[a-z]+-[a-z]+-[a-z]+$/);
    expect(campo).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('"Ler o aviso" abre um diálogo e fecha por "Entendi"', async () => {
    const { usuario } = await abrir();
    await passo1(usuario);
    await screen.findByRole('heading', { name: 'Seu responsável' });
    await passo2(usuario, emailFicticio('responsavel'), /E-mail do responsável/);
    await screen.findByRole('heading', { name: 'Crie sua senha' });
    await usuario.click(screen.getByRole('button', { name: 'Ler o aviso' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Aviso de privacidade para estudantes' });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Entendi' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('senha comum (erro do servidor) volta ao passo da senha com a mensagem do catálogo', async () => {
    const { usuario } = await abrir();
    await passo1(usuario);
    await screen.findByRole('heading', { name: 'Seu responsável' });
    await passo2(usuario, emailFicticio('responsavel'), /E-mail do responsável/);
    await screen.findByRole('heading', { name: 'Crie sua senha' });
    await passo3(usuario, '12345678');
    expect(await screen.findByRole('alert')).toHaveTextContent('Essa senha é muito comum. Escolha outra.');
    expect(screen.getByRole('heading', { name: 'Crie sua senha' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Senha/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('apelido ocupado (409): sorteia outro, volta ao passo 1 e avisa', async () => {
    const { usuario } = await abrir();
    const antes = (screen.getByLabelText('Seu apelido') as HTMLInputElement).value;
    await passo1(usuario);
    await screen.findByRole('heading', { name: 'Seu responsável' });
    await passo2(usuario, emailFicticio('responsavel'), /E-mail do responsável/);
    await screen.findByRole('heading', { name: 'Crie sua senha' });
    // Outra pessoa ocupa o apelido antes do envio (corrida rara, DC-03).
    db().usuarios.push({ ...db().usuarios[0]!, id: 'X'.repeat(26), apelido: antes });
    await passo3(usuario);
    expect(await screen.findByRole('heading', { name: 'Sobre você' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Esse apelido já existe. Vamos sortear outro.');
    expect((screen.getByLabelText('Seu apelido') as HTMLInputElement).value).not.toBe(antes);
  });

  it('429 do cadastro: mensagem de espera e os dados continuam na tela', async () => {
    const { usuario } = await abrir();
    await passo1(usuario);
    await screen.findByRole('heading', { name: 'Seu responsável' });
    await passo2(usuario, 'limite@example.test', /E-mail do responsável/);
    await screen.findByRole('heading', { name: 'Crie sua senha' });
    await passo3(usuario);
    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas tentativas. Espere alguns minutos e tente de novo.');
    expect(screen.getByLabelText(/^Senha/)).toHaveValue(SENHA_TESTE);
  });

  it('428: mostra o desafio e conclui ao reenviar (mesmo formulário)', async () => {
    const { usuario } = await abrir();
    await passo1(usuario);
    await screen.findByRole('heading', { name: 'Seu responsável' });
    await passo2(usuario, 'desafio@example.test', /E-mail do responsável/);
    await screen.findByRole('heading', { name: 'Crie sua senha' });
    await passo3(usuario);
    await usuario.click(await screen.findByRole('checkbox', { name: /Não sou um robô/ }));
    await usuario.click(screen.getByRole('button', { name: 'Criar minha conta' }));
    expect(await screen.findByRole('heading', { name: 'Falta pouco!' })).toBeInTheDocument();
  });

  it('duplo clique em "Criar minha conta" cria uma única conta (Idempotency-Key + trava)', async () => {
    const { usuario } = await abrir();
    await passo1(usuario);
    await screen.findByRole('heading', { name: 'Seu responsável' });
    await passo2(usuario, emailFicticio('responsavel'), /E-mail do responsável/);
    await screen.findByRole('heading', { name: 'Crie sua senha' });
    const antes = db().usuarios.length;
    await usuario.type(screen.getByLabelText(/^Senha/), SENHA_TESTE);
    await usuario.click(screen.getByRole('checkbox', { name: /Li o aviso/ }));
    await usuario.dblClick(screen.getByRole('button', { name: 'Criar minha conta' }));
    await screen.findByRole('heading', { name: 'Falta pouco!' });
    expect(db().usuarios.length).toBe(antes + 1);
  });

  it('falha ao carregar o apelido: oferece "Tentar de novo"', async () => {
    servidor.use(http.get('*/api/v1/cadastro/apelido-sugerido', () => HttpResponse.error()), );
    const { usuario } = renderizarApp('/cadastro');
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão.');
    servidor.resetHandlers();
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { name: 'Sobre você' })).toBeInTheDocument();
  });
});
