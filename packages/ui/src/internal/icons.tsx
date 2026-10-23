import type { SVGProps } from 'react';
import { cx } from './cx';

export type IconName = 'info' | 'success' | 'warning' | 'error' | 'chevron-down' | 'close';

const CAMINHOS: Record<IconName, string> = {
  // Formas distintas por tipo: o estado nunca depende só da cor.
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5a1.25 1.25 0 1 1 0 2.5A1.25 1.25 0 0 1 12 7Zm1.5 10h-3v-1.5h.75v-4h-.75V10h2.25v5.5h.75V17Z',
  success: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.6 14.4L6.6 12.6l1.4-1.4 2.4 2.4 5.6-5.6 1.4 1.4-7 7Z',
  warning: 'M12 2.5 22.5 21h-21L12 2.5Zm-1 6.5v6h2V9h-2Zm0 8v2h2v-2h-2Z',
  error: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 5h2v6h-2V7Zm0 8h2v2h-2v-2Z',
  'chevron-down': 'M6.4 8.6 12 14.2l5.6-5.6L19 10l-7 7-7-7 1.4-1.4Z',
  close: 'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4 6.4 5Z',
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  small?: boolean;
}

/** Ícone decorativo: sempre acompanhado de texto, por isso fica oculto para leitores de tela. */
export function Icon({ name, small, className, ...resto }: IconProps) {
  return (
    <svg
      className={cx('am-icon', small && 'am-icon--sm', className)}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...resto}
    >
      <path fillRule="evenodd" d={CAMINHOS[name]} />
    </svg>
  );
}
