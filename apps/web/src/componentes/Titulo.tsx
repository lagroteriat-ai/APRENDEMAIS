import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';

/**
 * `<h1>` da tela. Ao aparecer: atualiza o título da aba e leva o foco ao título, para quem usa leitor de
 * tela perceber a troca de página (SPA). Use `key` para refazer isso a cada passo de um fluxo.
 */
export function Titulo({ children, abaTitulo }: { children: string; abaTitulo?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = `${abaTitulo ?? children} · Aprende+`;
    ref.current?.focus({ preventScroll: true });
  }, [children, abaTitulo]);
  return (
    <h1 ref={ref} tabIndex={-1} className="web-titulo">
      {children}
    </h1>
  );
}

export function Subtitulo({ children }: { children: ReactNode }) {
  return <p className="web-subtitulo">{children}</p>;
}

/**
 * Lê o token do link (`?t=`) uma vez e já limpa a URL (RQ-32: o token não fica em histórico, barra
 * de endereço nem `Referer`). Recarregar a página perde o token: é o comportamento esperado.
 */
export function useTokenDeLink(): string | null {
  const { search, pathname } = useLocation();
  const navegar = useNavigate();
  const token = useRef<string | null | undefined>(undefined);
  token.current ??= new URLSearchParams(search).get('t');
  useEffect(() => {
    if (search) navegar({ pathname, search: '' }, { replace: true });
  }, [search, pathname, navegar]);
  return token.current;
}
