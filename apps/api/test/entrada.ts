// Entrypoint usado só pelos testes: o Worker real + as classes de Durable Object declaradas no
// wrangler.toml. Se `src/index.ts` passar a exportar `Limitador`, a linha explícita abaixo prevalece
// sobre o `export *` (sem conflito).
export { default } from '../src/index';
export * from '../src/index';
export { Limitador } from '../src/limitador';
