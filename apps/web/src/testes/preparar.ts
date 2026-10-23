import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { reiniciarBanco } from '../mocks/banco';
import { servidor } from '../mocks/servidor';

// A API simulada (MSW) atende todas as chamadas; qualquer rota sem handler derruba o teste.
beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => reiniciarBanco());
afterEach(() => {
  cleanup();
  servidor.resetHandlers();
});
afterAll(() => servidor.close());

// jsdom não implementa os métodos do <dialog>: simula `open` e o evento `close`.
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
