import { useEffect, useRef } from 'react';
import { Alert, Checkbox } from '@aprendemais/ui';
import { mockAtivo, turnstileSiteKey } from '../config';

/** Token aceito pela API simulada (só existe com `VITE_API_MOCK=true`). */
export const TOKEN_DESAFIO_SIMULADO = 'mock-turnstile-token';

interface TurnstileApi {
  render: (el: HTMLElement, opcoes: Record<string, unknown>) => string;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function carregarScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existente = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    const script = existente ?? Object.assign(document.createElement('script'), { src: SCRIPT, async: true });
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('turnstile')), { once: true });
    if (!existente) document.head.append(script);
  });
}

/**
 * Desafio Turnstile (DC-06), exibido só quando a API responde 428 `DESAFIO_REQUERIDO`.
 * `onToken(undefined)` = ainda não resolvido ou expirou. O servidor valida o token.
 */
export function Desafio({ onToken }: { onToken: (token: string | undefined) => void }) {
  const alvo = useRef<HTMLDivElement>(null);
  const aoTer = useRef(onToken);
  aoTer.current = onToken;
  const usaWidget = turnstileSiteKey !== '';

  useEffect(() => {
    if (!usaWidget) return;
    let widgetId: string | undefined;
    let cancelado = false;
    carregarScript()
      .then(() => {
        if (cancelado || !alvo.current || !window.turnstile) return;
        widgetId = window.turnstile.render(alvo.current, {
          sitekey: turnstileSiteKey,
          language: 'pt-br',
          callback: (token: string) => aoTer.current(token),
          'expired-callback': () => aoTer.current(undefined),
          'error-callback': () => aoTer.current(undefined),
        });
      })
      .catch(() => aoTer.current(undefined));
    return () => {
      cancelado = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [usaWidget]);

  if (usaWidget) return <div ref={alvo} aria-label="Verificação de segurança" />;
  if (mockAtivo) {
    return (
      <Checkbox
        label="Não sou um robô (desafio de teste)"
        onChange={(e) => onToken(e.target.checked ? TOKEN_DESAFIO_SIMULADO : undefined)}
      />
    );
  }
  return (
    <Alert variant="warning" title="Verificação indisponível">
      Não foi possível mostrar a verificação de segurança agora. Tente de novo mais tarde.
    </Alert>
  );
}
