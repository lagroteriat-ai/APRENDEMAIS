import { useEffect, useRef, type ReactNode } from 'react';
import { Alert } from '@aprendemais/ui';

export interface ErroDeCampo {
  /** `id` do controle que recebe o foco ao clicar no link. */
  id: string;
  mensagem: string;
}

interface Props {
  titulo: string;
  /** Erros por campo (cada um vira um link para o campo). */
  erros?: ErroDeCampo[];
  /** Texto extra sem campo (ex.: id da requisição). */
  children?: ReactNode;
  /** Muda a cada tentativa de envio com erro: leva o foco ao resumo (fluxos.md §9). */
  foco: number;
  variante?: 'error' | 'warning' | 'info';
}

/** Resumo de erros no topo do formulário: `role="alert"`, recebe o foco e liga a cada campo. */
export function ResumoDeErros({ titulo, erros = [], children, foco, variante = 'error' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (foco > 0) ref.current?.focus();
  }, [foco]);

  return (
    <Alert ref={ref} variant={variante} tabIndex={-1} title={titulo}>
      {children}
      {erros.length > 0 && (
        <ul>
          {erros.map((e) => (
            <li key={e.id}>
              <a
                href={`#${e.id}`}
                onClick={(ev) => {
                  ev.preventDefault();
                  document.getElementById(e.id)?.focus();
                }}
              >
                {e.mensagem}
              </a>
            </li>
          ))}
        </ul>
      )}
    </Alert>
  );
}
