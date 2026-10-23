import { useSyncExternalStore } from 'react';
import { CONTAS_DE_TESTE, assinar, db, reiniciarBanco, mudou } from './banco';

/* Só aparece no modo simulado. Mostra os "e-mails enviados" (links de T06, T10, T12) e as contas de teste. */

let versao = 0;
function assinarComVersao(aoMudar: () => void) {
  return assinar(() => {
    versao += 1;
    aoMudar();
  });
}

export default function PainelMock() {
  useSyncExternalStore(assinarComVersao, () => versao);
  const emails = [...db().emails].reverse();

  return (
    <details className="web-painel-mock">
      <summary>Modo simulado ({emails.length} e-mails)</summary>
      <p>
        A API é simulada no navegador (MSW). Nada é enviado de verdade. Recarregar mantém os dados nesta aba.
      </p>
      <h2>E-mails enviados</h2>
      {emails.length === 0 ? (
        <p>Nenhum ainda.</p>
      ) : (
        <ul>
          {emails.map((e) => (
            <li key={e.id}>
              <strong>{e.tipo}</strong> para {e.para} — {e.assunto}
              <br />
              {/* Navegação completa de propósito: o banco simulado persiste na aba (sessionStorage). */}
              <a href={e.link}>Abrir o link do e-mail</a>
            </li>
          ))}
        </ul>
      )}
      <h2>Contas de teste</h2>
      <ul>
        {CONTAS_DE_TESTE.map((c) => (
          <li key={c.entrar}>
            {c.quem}: <code>{c.entrar}</code> / <code>{c.senha}</code>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          reiniciarBanco();
          mudou();
          window.location.assign('/entrar');
        }}
      >
        Reiniciar dados simulados
      </button>
    </details>
  );
}
