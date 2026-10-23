/* Microcopy PROVISÓRIA. O texto final dos avisos de privacidade (aluno, responsável, professor) é da PED-02;
   a VERSÃO aceita sempre vem da API (`obterAvisosVigentes` / `pedido.aviso.versao`), nunca daqui. */

export interface AvisoTexto {
  titulo: string;
  paragrafos: string[];
}

export const AVISO_ALUNO: AvisoTexto = {
  titulo: 'Aviso de privacidade para estudantes',
  paragrafos: [
    'Guardamos só o seu apelido, o mês e o ano em que você nasceu, o seu ano escolar e o seu progresso nas atividades.',
    'Não pedimos CPF, endereço ou foto. Não mostramos anúncios. Não vendemos nem compartilhamos os seus dados.',
    'Seu responsável pode mudar de ideia quando quiser e pedir para apagar tudo.',
  ],
};

export const AVISO_PROFESSOR: AvisoTexto = {
  titulo: 'Aviso de privacidade para professores',
  paragrafos: [
    'Guardamos o seu nome, o seu e-mail institucional e a escola, só para você usar a plataforma com as suas turmas.',
    'Você pode pedir a correção ou a exclusão dos seus dados quando quiser.',
  ],
};

export const O_QUE_GUARDAMOS = [
  'apelido, mês e ano de nascimento',
  'ano escolar',
  'progresso nas atividades',
];

export const O_QUE_NAO_FAZEMOS = [
  'pedir CPF, endereço ou foto',
  'mostrar anúncios',
  'vender ou compartilhar dados',
];
