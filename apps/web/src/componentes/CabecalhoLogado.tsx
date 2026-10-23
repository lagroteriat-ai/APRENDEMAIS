import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Container, Modal } from '@aprendemais/ui';
import type { Me } from '@aprendemais/shared-types';
import { AVISO_ALUNO, AVISO_PROFESSOR } from '../conteudo/avisos';
import { useSessao } from '../estado/sessao';
import { ROTAS } from '../rotas';
import { Logo } from './TelaPublica';

/** Cabeçalho da área logada: logo + menu do usuário (Trocar papel, Privacidade, Sair). */
export function CabecalhoLogado({ me, rotulo }: { me: Me; rotulo: string }) {
  const [aberto, setAberto] = useState(false);
  const [privacidade, setPrivacidade] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const { sair } = useSessao();
  const navegar = useNavigate();

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAberto(false);
        botao.current?.focus();
      }
    };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  const aviso = me.papelAtivo === 'professor' ? AVISO_PROFESSOR : AVISO_ALUNO;

  async function aoSair() {
    setSaindo(true);
    await sair();
    navegar(ROTAS.entrar, { replace: true });
  }

  return (
    <div className="web-cabecalho-logado am-on-dark">
      <Container>
        <div className="web-cabecalho">
          <Logo />
          <div className="web-menu" ref={raiz}>
            <button
              ref={botao}
              type="button"
              className="web-menu__botao"
              aria-expanded={aberto}
              aria-controls={menuId}
              onClick={() => setAberto((v) => !v)}
            >
              {rotulo} <span aria-hidden="true">▾</span>
            </button>
            {aberto && (
              <ul id={menuId} className="web-menu__lista">
                {me.papeis.length > 1 && (
                  <li>
                    <button type="button" onClick={() => navegar(ROTAS.papel)}>
                      Trocar papel
                    </button>
                  </li>
                )}
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setAberto(false);
                      setPrivacidade(true);
                    }}
                  >
                    Privacidade
                  </button>
                </li>
                <li>
                  <button type="button" onClick={aoSair} aria-disabled={saindo || undefined}>
                    {saindo ? 'Saindo…' : 'Sair'}
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
      </Container>
      <Modal
        open={privacidade}
        onClose={() => setPrivacidade(false)}
        title={aviso.titulo}
        footer={<Button onClick={() => setPrivacidade(false)}>Entendi</Button>}
      >
        {aviso.paragrafos.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </Modal>
    </div>
  );
}
