import { resolve } from 'node:path';

export const PORTA_API = 8787;
export const PORTA_WEB = 4173;
export const ORIGEM_WEB_LOCAL = `http://localhost:${PORTA_WEB}`;

/** `E2E_BASE_URL` definido = contra preview/staging; indefinido = servidores locais (scripts/e2e-acesso.mjs). */
export const REMOTO: string | undefined = process.env.E2E_BASE_URL || undefined;
export const LOCAL = REMOTO === undefined;

export const RAIZ = process.cwd();
export const DIR_API = resolve(RAIZ, 'apps', 'api');
export const DIR_ESTADO = resolve(RAIZ, '.wrangler', 'e2e-acesso');

// Semente do ambiente local (scripts/e2e-acesso.mjs). Convites de professor não têm tela nem CLI no Sprint 1 (DU-04).
export const CONVITE_PROFESSOR = process.env.E2E_CONVITE_PROFESSOR ?? 'e2e-convite-professor-valido-0000000000001';
export const CONVITE_EXPIRADO = process.env.E2E_CONVITE_EXPIRADO ?? 'e2e-convite-professor-expirado-000000002';
export const EMAIL_PROFESSOR = process.env.E2E_EMAIL_PROFESSOR ?? 'professora.e2e@example.test';
export const NOME_PROFESSOR = 'Professora Teste E2E';
export const SENHA_PROFESSOR = 'giz-de-cera-trinta-e-tres';

/** Mensagens da SPA (apps/web/src/api/mensagens.ts) usadas nas asserções. */
export const TEXTO = {
  loginInvalido: 'Usuário ou senha incorretos.',
  semAcesso: 'Você não tem acesso a esta página.',
  sessaoAcabou: 'Sua sessão acabou.',
  linkInvalido: 'Este link não funciona',
  esperePedirDeNovo: 'Espere um pouco para pedir de novo.'
} as const;
