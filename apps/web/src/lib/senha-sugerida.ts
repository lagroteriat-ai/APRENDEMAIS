const PALAVRAS = [
  'bola', 'nuvem', 'sete', 'lua', 'rio', 'pipa', 'mapa', 'tinta', 'verde', 'onda', 'leite', 'barco',
  'flor', 'trem', 'ponte', 'ouro', 'vento', 'sol', 'folha', 'coral', 'jogo', 'doce', 'luz', 'mel',
  'peixe', 'pedra', 'livro', 'cacau', 'fogo', 'gato', 'praia', 'cravo', 'selva', 'trigo', 'nove',
  'dado', 'lago', 'milho', 'pato', 'queijo', 'rosa', 'sino', 'tigre', 'uva', 'vela', 'zebra', 'prata',
];

/** Três palavras ao acaso (ex.: `bola-nuvem-sete`), fáceis de anotar. O servidor ainda confere a senha. */
export function sugerirSenha(): string {
  const sorteio = globalThis.crypto.getRandomValues(new Uint32Array(3));
  return [...sorteio].map((n) => PALAVRAS[n % PALAVRAS.length]).join('-');
}
