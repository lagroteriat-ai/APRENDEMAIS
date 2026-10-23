import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

// jsdom ainda não implementa os métodos do <dialog>; reproduz o essencial
// (atributo `open` e evento `close`). Foco preso e Esc nativos só existem em navegador real.
if (typeof HTMLDialogElement !== 'undefined') {
  const dialog = HTMLDialogElement.prototype;
  if (typeof dialog.showModal !== 'function') {
    dialog.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  }
  if (typeof dialog.close !== 'function') {
    dialog.close = function close(this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
}
