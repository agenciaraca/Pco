/**
 * Que arquivo é este, de verdade.
 *
 * Até 7/set/2026 `saveUpload` decidia a extensão por `file.type` — o
 * `Content-Type` que o **cliente** escreve na parte do multipart. Ninguém
 * olhava um byte do conteúdo. `POST /uploads` é `requireAuth()`, não
 * `requireAuth('admin')`: bastava declarar `image/png` para qualquer um dos
 * ~1.600 alunos gravar bytes arbitrários e receber de volta uma URL no domínio
 * da escola.
 *
 * **O que isso NÃO era**, e vale escrever para ninguém superestimar depois: não
 * era execução de script. `/uploads/*` sai com `X-Content-Type-Options: nosniff`
 * (`server/public/csp.ts`) e o `serveStatic` deriva o `Content-Type` da
 * extensão, então HTML gravado como `.png` chega ao navegador como `image/png`
 * e não roda. O que havia era hospedagem de arquivo arbitrário sob o domínio
 * de uma escola — que é o que empresta credibilidade a um golpe, e o motivo de
 * documento já ser restrito à administração.
 *
 * A regra que este módulo implementa: **o conteúdo decide**. O tipo declarado
 * não participa mais da decisão — nem para confirmar, nem para desempatar.
 * Nada reconhecido é recusado (falha fechada), porque "não sei o que é isto"
 * não pode virar "então deixa passar".
 */

/** Um tipo é reconhecido só quando o conteúdo prova. Sem prova, `null`. */
export function detectarTipo(buf: Buffer): string | null {
  if (buf.length < 4) return null;

  // PNG: assinatura de 8 bytes, desenhada para sobreviver a transferência
  // que corrompe fim de linha — daí o \r\n\x1a\n no meio dela.
  if (comeca(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';

  // JPEG: SOI (FF D8) seguido do primeiro marcador (FF).
  if (comeca(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg';

  // GIF: as duas versões que existem.
  if (texto(buf, 0, 6) === 'GIF87a' || texto(buf, 0, 6) === 'GIF89a') return 'image/gif';

  // WEBP é um contêiner RIFF: "RIFF" + 4 bytes de tamanho + "WEBP".
  if (texto(buf, 0, 4) === 'RIFF' && texto(buf, 8, 4) === 'WEBP') return 'image/webp';

  // EPUB é um ZIP com uma exigência do OCF: o primeiro arquivo tem de ser
  // `mimetype`, sem compressão, e é por isso que o valor aparece em claro no
  // deslocamento 30. Sem essa checagem, todo .zip passaria por EPUB.
  if (comeca(buf, [0x50, 0x4b, 0x03, 0x04])) {
    return texto(buf, 30, 28) === 'mimetypeapplication/epub+zip'
      ? 'application/epub+zip'
      : null;
  }

  // ISO-BMFF ("ftyp" no deslocamento 4): é o contêiner de .m4a E de .mp4.
  // Distinguir áudio de vídeo exigiria ler as trilhas; o que a checagem prova
  // é que o arquivo é um contêiner de mídia de verdade, não outra coisa
  // fantasiada. Para o uso — material da biblioteca, subido só pela
  // administração — é o que basta, e os dois são inertes.
  if (texto(buf, 4, 4) === 'ftyp') {
    const marca = texto(buf, 8, 4);
    return ['M4A ', 'M4B ', 'mp42', 'mp41', 'isom', 'iso2'].includes(marca)
      ? 'audio/mp4'
      : null;
  }

  // MP3 aparece de duas formas: com tag ID3 na frente, ou já no primeiro
  // quadro. O sincronismo de quadro são 11 bits ligados (FF Ex ou FF Fx).
  if (texto(buf, 0, 3) === 'ID3') return 'audio/mpeg';
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return 'audio/mpeg';

  // PDF: a ISO 32000 manda o leitor aceitar o cabeçalho dentro do primeiro
  // kilobyte, e não só no byte zero — arquivo gerado por ferramenta que
  // prefixa lixo continua sendo PDF válido para todo leitor do mundo. Ser mais
  // rígido aqui recusaria apostila legítima, que é regressão visível para quem
  // administra.
  if (buf.subarray(0, 1024).includes(Buffer.from('%PDF-'))) return 'application/pdf';

  return null;
}

function comeca(buf: Buffer, bytes: number[]): boolean {
  if (buf.length < bytes.length) return false;
  return bytes.every((b, i) => buf[i] === b);
}

function texto(buf: Buffer, inicio: number, tamanho: number): string {
  if (buf.length < inicio + tamanho) return '';
  return buf.subarray(inicio, inicio + tamanho).toString('latin1');
}
