import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { criarCliente, type Cliente } from '../api/cliente';

const ApiContext = createContext<Cliente | null>(null);

/** Entrega o cliente de API às telas. Testes podem injetar outro cliente (`cliente`). */
export function ApiProvider({ cliente, children }: { cliente?: Cliente; children: ReactNode }) {
  const valor = useMemo(() => cliente ?? criarCliente(), [cliente]);
  return <ApiContext.Provider value={valor}>{children}</ApiContext.Provider>;
}

export function useApi(): Cliente {
  const cliente = useContext(ApiContext);
  if (!cliente) throw new Error('useApi fora do ApiProvider');
  return cliente;
}
