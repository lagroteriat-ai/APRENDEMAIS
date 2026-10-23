import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { cx } from '../internal/cx';
import { Icon } from '../internal/icons';

export interface ModalProps {
  open: boolean;
  /** Chamado ao pedir para fechar (Esc, botão Fechar, clique no fundo). Quem controla `open` decide. */
  onClose: () => void;
  /** Título (obrigatório: nomeia a janela para leitores de tela). */
  title: ReactNode;
  children?: ReactNode;
  /** Ações (botões) no rodapé. */
  footer?: ReactNode;
  /**
   * Elemento que recebe o foco ao abrir. Padrão: o título.
   * Em confirmações destrutivas, aponte para o botão seguro ("Voltar").
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Fecha ao clicar no fundo. Padrão: true. */
  closeOnBackdrop?: boolean;
  closeLabel?: string;
  className?: string;
}

/**
 * Janela modal sobre `<dialog>` nativo: foco preso, fundo inerte, Esc fecha e o foco volta
 * a quem abriu. O conteúdo só é renderizado enquanto aberto (o estado interno é descartado).
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  initialFocusRef,
  closeOnBackdrop = true,
  closeLabel = 'Fechar',
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const cliqueIniciouNoFundo = useRef(false);
  const tituloId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      (initialFocusRef?.current ?? tituloRef.current)?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialFocusRef]);

  // Se o componente sair da tela com a janela aberta, libera o fundo.
  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={cx('am-modal', className)}
      aria-labelledby={tituloId}
      // Esc: a decisão de fechar é de quem controla `open`.
      onCancel={(evento) => {
        evento.preventDefault();
        onClose();
      }}
      // Fechamento por outro meio (ex.: segundo Esc forçado pelo navegador).
      onClose={() => {
        if (open) onClose();
      }}
      // Só fecha se o clique começou e terminou no fundo (arrastar texto para fora não fecha).
      onMouseDown={(evento) => {
        cliqueIniciouNoFundo.current = evento.target === evento.currentTarget;
      }}
      onClick={(evento) => {
        if (closeOnBackdrop && cliqueIniciouNoFundo.current && evento.target === evento.currentTarget) {
          onClose();
        }
      }}
    >
      {open && (
        <div className="am-modal__inner">
          <div className="am-modal__header">
            <h2 id={tituloId} ref={tituloRef} className="am-modal__title" tabIndex={-1}>
              {title}
            </h2>
            <button type="button" className="am-modal__close" aria-label={closeLabel} onClick={onClose}>
              <Icon name="close" />
            </button>
          </div>
          {children}
          {footer && <div className="am-modal__footer">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
