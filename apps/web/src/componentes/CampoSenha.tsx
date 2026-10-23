import { useState, type ReactNode } from 'react';
import { Button, FormField, Input } from '@aprendemais/ui';
import { sugerirSenha } from '../lib/senha-sugerida';

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (valor: string) => void;
  autoComplete: 'current-password' | 'new-password';
  erro?: string;
  ajuda?: ReactNode;
  required?: boolean;
  /** Mostra o botão "Sugerir uma senha fácil" (só na criação de senha). */
  sugerir?: boolean;
}

/** Campo de senha com "Mostrar/Ocultar" e, opcionalmente, "Sugerir uma senha fácil". Colar é permitido (WCAG 3.3.8). */
export function CampoSenha({ id, label, value, onChange, autoComplete, erro, ajuda, required, sugerir }: Props) {
  const [visivel, setVisivel] = useState(false);
  const [aviso, setAviso] = useState('');

  return (
    <>
      <FormField id={id} label={label} help={ajuda} error={erro} required={required}>
        <Input
          type={visivel ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          endAction={
            <Button variant="secondary" aria-pressed={visivel} onClick={() => setVisivel((v) => !v)}>
              {visivel ? 'Ocultar' : 'Mostrar'}
            </Button>
          }
        />
      </FormField>
      {sugerir && (
        <div>
          <Button
            variant="link"
            onClick={() => {
              onChange(sugerirSenha());
              setVisivel(true);
              setAviso('Sugerimos uma senha e ela está visível. Anote antes de continuar.');
            }}
          >
            Sugerir uma senha fácil
          </Button>
          <p role="status" className="web-ajuda">
            {aviso}
          </p>
        </div>
      )}
    </>
  );
}
