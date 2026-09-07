/**
 * Bytes de arquivo de verdade, para os testes de upload.
 *
 * Existe porque as fixtures antigas eram `new Uint8Array(n)` — zeros — com o
 * `type` declarado no construtor do `File`. Elas provavam que `saveUpload`
 * aceitava um rótulo, nunca que aceitava uma imagem. Foi por isso que o
 * upload passou a vida decidindo a extensão pelo `file.type` do cliente com a
 * suíte verde: os testes mentiam junto com o código.
 *
 * Cada função devolve o menor conteúdo que ainda é o formato de verdade.
 */

/** PNG 1x1 transparente — o menor PNG válido que existe. */
export function bytesPng(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
}

/** JPEG mínimo: SOI + APP0/JFIF + EOI. */
export function bytesJpeg(): Buffer {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
    Buffer.from('JFIF\0', 'latin1'),
    Buffer.from([0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]),
    Buffer.from([0xff, 0xd9]),
  ]);
}

/** GIF89a 1x1. */
export function bytesGif(): Buffer {
  return Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
}

/** WEBP: contêiner RIFF com o marcador WEBP no deslocamento 8. */
export function bytesWebp(): Buffer {
  const corpo = Buffer.concat([
    Buffer.from('WEBP', 'latin1'),
    Buffer.from('VP8 ', 'latin1'),
    Buffer.alloc(16),
  ]);
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32LE(corpo.length, 0);
  return Buffer.concat([Buffer.from('RIFF', 'latin1'), tamanho, corpo]);
}

/** PDF: cabeçalho, um objeto e o marcador de fim. */
export function bytesPdf(): Buffer {
  return Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n',
    'latin1',
  );
}

/**
 * EPUB: ZIP cujo primeiro registro é o arquivo `mimetype`, sem compressão.
 * É exigência do OCF, e é o que separa um EPUB de um `.zip` qualquer — o valor
 * fica em claro no deslocamento 30.
 */
export function bytesEpub(): Buffer {
  const nome = 'mimetype';
  const valor = 'application/epub+zip';
  const cabecalho = Buffer.alloc(30);
  cabecalho.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
  cabecalho.writeUInt16LE(20, 4); // versão
  cabecalho.writeUInt16LE(0, 6); // flags
  cabecalho.writeUInt16LE(0, 8); // método: 0 = sem compressão
  cabecalho.writeUInt32LE(0, 14); // crc (irrelevante para a checagem)
  cabecalho.writeUInt32LE(valor.length, 18);
  cabecalho.writeUInt32LE(valor.length, 22);
  cabecalho.writeUInt16LE(nome.length, 26);
  cabecalho.writeUInt16LE(0, 28);
  return Buffer.concat([
    cabecalho,
    Buffer.from(nome, 'latin1'),
    Buffer.from(valor, 'latin1'),
  ]);
}

/** MP3 com tag ID3v2 na frente. */
export function bytesMp3(): Buffer {
  return Buffer.concat([
    Buffer.from('ID3', 'latin1'),
    Buffer.from([0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0a]),
    Buffer.alloc(10),
  ]);
}

/** M4A: contêiner ISO-BMFF, "ftyp" no deslocamento 4 e a marca logo depois. */
export function bytesM4a(): Buffer {
  return Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x18]),
    Buffer.from('ftyp', 'latin1'),
    Buffer.from('M4A ', 'latin1'),
    Buffer.alloc(12),
  ]);
}

/** Um arquivo que NÃO é nada da lista: HTML. O caso do ataque. */
export function bytesHtml(): Buffer {
  return Buffer.from('<html><script>alert(1)</script></html>', 'latin1');
}

/** SVG — imagem para o olho, documento que executa script para o navegador. */
export function bytesSvg(): Buffer {
  return Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    'latin1',
  );
}

/** Empacota bytes como `File`, com o tipo que o CLIENTE declara. */
export function arquivo(nome: string, tipoDeclarado: string, bytes: Buffer): File {
  return new File([new Uint8Array(bytes)], nome, { type: tipoDeclarado });
}
