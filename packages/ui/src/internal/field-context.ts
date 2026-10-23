import { createContext, useContext } from 'react';

/** Dados que o FormField repassa ao controle (Input, Select) dentro dele. */
export interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

export function useFieldContext(): FieldContextValue | null {
  return useContext(FieldContext);
}

interface PropsDoControle {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling';
  'aria-required'?: boolean | 'true' | 'false';
  invalid?: boolean;
  required?: boolean;
}

/** Combina as props do controle com o contexto do FormField (props explícitas vencem). */
export function resolverCampo(ctx: FieldContextValue | null, props: PropsDoControle) {
  const descritores = [ctx?.describedBy, props['aria-describedby']].filter(Boolean).join(' ');
  const invalido = props.invalid ?? ctx?.invalid ?? false;
  const obrigatorio = props.required ?? ctx?.required ?? false;
  return {
    id: props.id ?? ctx?.id,
    'aria-describedby': descritores || undefined,
    'aria-invalid': props['aria-invalid'] ?? (invalido ? true : undefined),
    'aria-required': props['aria-required'] ?? (obrigatorio ? true : undefined),
  };
}
