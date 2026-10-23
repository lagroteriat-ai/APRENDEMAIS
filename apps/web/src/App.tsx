import { Navigate, Route, Routes } from 'react-router';
import { AreaEmBreve, ContaEmExclusao, SemAcesso, SessaoExpirada } from './componentes/Estados';
import { Protegida } from './componentes/Protegida';
import { ConfirmarEmail } from './paginas/ConfirmarEmail';
import { Entrar } from './paginas/Entrar';
import { EscolherPapel } from './paginas/EscolherPapel';
import { InicioAluno } from './paginas/InicioAluno';
import { InicioProfessor } from './paginas/InicioProfessor';
import { NovaSenha } from './paginas/NovaSenha';
import { Recuperar } from './paginas/Recuperar';
import { Aguardando } from './paginas/cadastro/Aguardando';
import { Cadastro } from './paginas/cadastro/Cadastro';
import { Autorizar } from './paginas/responsavel/Autorizar';
import { ROTAS } from './rotas';

/** Rotas da v0.1 (fluxos.md T01–T16). Telas públicas não consultam `/me`; só as logadas passam por `Protegida`. */
export function App() {
  return (
    <Routes>
      <Route index element={<Navigate to={ROTAS.entrar} replace />} />
      <Route path={ROTAS.entrar} element={<Entrar />} />
      <Route path={ROTAS.cadastro} element={<Cadastro />} />
      <Route path={ROTAS.aguardando} element={<Aguardando />} />
      <Route path={ROTAS.autorizar} element={<Autorizar />} />
      <Route path={ROTAS.recuperar} element={<Recuperar />} />
      <Route path={ROTAS.novaSenha} element={<NovaSenha />} />
      <Route path={ROTAS.confirmarEmail} element={<ConfirmarEmail />} />
      <Route path={ROTAS.papel} element={<EscolherPapel />} />
      <Route path={ROTAS.aluno} element={<Protegida papel="aluno">{(me) => <InicioAluno me={me} />}</Protegida>} />
      <Route
        path={ROTAS.professor}
        element={<Protegida papel="professor">{(me) => <InicioProfessor me={me} />}</Protegida>}
      />
      <Route path={ROTAS.emBreve} element={<AreaEmBreve />} />
      <Route path={ROTAS.emExclusao} element={<ContaEmExclusao />} />
      <Route path={ROTAS.sessaoExpirada} element={<SessaoExpirada />} />
      <Route path="*" element={<SemAcesso />} />
    </Routes>
  );
}
