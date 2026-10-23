import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { esperarSemViolacoes } from '../test/axe';
import { Button } from './Button';
import { Modal } from './Modal';

describe('Modal', () => {
  it('fechado: não renderiza o conteúdo nem aparece como diálogo', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Retirar autorização">
        Conteúdo secreto
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Conteúdo secreto')).not.toBeInTheDocument();
  });

  it('aberto: é um diálogo nomeado pelo título e foca o título', () => {
    render(
      <Modal open onClose={() => {}} title="Aviso de privacidade">
        Texto do aviso.
      </Modal>,
    );
    const dialogo = screen.getByRole('dialog', { name: 'Aviso de privacidade' });
    expect(dialogo).toHaveTextContent('Texto do aviso.');
    expect(screen.getByRole('heading', { level: 2, name: 'Aviso de privacidade' })).toHaveFocus();
  });

  it('foca o elemento indicado em initialFocusRef (ex.: Voltar)', () => {
    function Exemplo() {
      const voltar = useRef<HTMLButtonElement>(null);
      return (
        <Modal
          open
          onClose={() => {}}
          title="Retirar a autorização?"
          initialFocusRef={voltar}
          footer={
            <>
              <Button variant="danger">Retirar</Button>
              <Button ref={voltar} variant="secondary">
                Voltar
              </Button>
            </>
          }
        >
          Isso não pode ser desfeito.
        </Modal>
      );
    }
    render(<Exemplo />);
    expect(screen.getByRole('button', { name: 'Voltar' })).toHaveFocus();
  });

  it('o botão Fechar chama onClose', async () => {
    const aoFechar = vi.fn();
    render(
      <Modal open onClose={aoFechar} title="Aviso">
        Texto
      </Modal>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(aoFechar).toHaveBeenCalledOnce();
  });

  it('Esc (evento cancel) pede para fechar sem fechar sozinho', () => {
    const aoFechar = vi.fn();
    render(
      <Modal open onClose={aoFechar} title="Aviso">
        Texto
      </Modal>,
    );
    const dialogo = screen.getByRole('dialog');
    const cancelar = new Event('cancel', { cancelable: true });
    dialogo.dispatchEvent(cancelar);
    expect(aoFechar).toHaveBeenCalledOnce();
    expect(cancelar.defaultPrevented).toBe(true);
    expect(dialogo).toHaveAttribute('open');
  });

  it('clique no fundo fecha; clique dentro não', () => {
    const aoFechar = vi.fn();
    render(
      <Modal open onClose={aoFechar} title="Aviso">
        <p>Texto</p>
      </Modal>,
    );
    const dialogo = screen.getByRole('dialog');
    fireEvent.mouseDown(screen.getByText('Texto'));
    fireEvent.click(screen.getByText('Texto'));
    expect(aoFechar).not.toHaveBeenCalled();
    fireEvent.mouseDown(dialogo);
    fireEvent.click(dialogo);
    expect(aoFechar).toHaveBeenCalledOnce();
  });

  it('closeOnBackdrop={false} ignora o clique no fundo', () => {
    const aoFechar = vi.fn();
    render(
      <Modal open onClose={aoFechar} title="Aviso" closeOnBackdrop={false}>
        Texto
      </Modal>,
    );
    const dialogo = screen.getByRole('dialog');
    fireEvent.mouseDown(dialogo);
    fireEvent.click(dialogo);
    expect(aoFechar).not.toHaveBeenCalled();
  });

  it('abre e fecha conforme `open` (uso controlado)', async () => {
    function Exemplo() {
      const [aberto, setAberto] = useState(false);
      return (
        <>
          <Button onClick={() => setAberto(true)}>Ler o aviso</Button>
          <Modal open={aberto} onClose={() => setAberto(false)} title="Aviso">
            Texto do aviso
          </Modal>
        </>
      );
    }
    render(<Exemplo />);
    await userEvent.click(screen.getByRole('button', { name: 'Ler o aviso' }));
    expect(screen.getByRole('dialog', { name: 'Aviso' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('não tem violações de acessibilidade', async () => {
    const { baseElement } = render(
      <Modal open onClose={() => {}} title="Aviso" footer={<Button>Entendi</Button>}>
        Texto
      </Modal>,
    );
    await esperarSemViolacoes(baseElement);
  });
});
