/**
 * O upload decidia a extensão pelo que o cliente DIZIA que o arquivo era.
 *
 * `saveUpload` lia `file.type` — o `Content-Type` que quem envia escreve na
 * parte do multipart, texto livre — e nunca olhava um byte do conteúdo.
 * `POST /uploads` é `requireAuth()`, não `requireAuth('admin')`: bastava
 * declarar `image/png` para qualquer um dos ~1.600 alunos gravar bytes
 * arbitrários e receber de volta uma URL sob o domínio da escola.
 *
 * **Não era execução de script**, e isso importa para ninguém superestimar o
 * achado depois: `/uploads/*` sai com `X-Content-Type-Options: nosniff` e o
 * `serveStatic` deriva o `Content-Type` da extensão, então HTML gravado como
 * `.png` chega como `image/png` e não roda. O que havia era hospedagem de
 * arquivo arbitrário no domínio de uma escola — o que empresta credibilidade a
 * um golpe, e a razão de documento já ser restrito à administração.
 *
 * A suíte não pegava isso porque as fixtures eram `new Uint8Array(n)`: zeros
 * com um rótulo. Elas provavam que o upload aceitava o rótulo. Ver
 * `test/apoio-arquivos.ts`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { detectarTipo } from '../server/uploads/assinaturas';
import {
  arquivo,
  bytesEpub,
  bytesGif,
  bytesHtml,
  bytesJpeg,
  bytesM4a,
  bytesMp3,
  bytesPdf,
  bytesPng,
  bytesSvg,
  bytesWebp,
} from './apoio-arquivos';

let tmpDir: string;
let store: typeof import('../server/uploads/store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-conteudo-'));
  process.env.DATA_DIR = tmpDir;
  store = await import('../server/uploads/store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('detectarTipo — o conteúdo é que diz o que o arquivo é', () => {
  it('reconhece os oito formatos aceitos', () => {
    expect(detectarTipo(bytesPng())).toBe('image/png');
    expect(detectarTipo(bytesJpeg())).toBe('image/jpeg');
    expect(detectarTipo(bytesGif())).toBe('image/gif');
    expect(detectarTipo(bytesWebp())).toBe('image/webp');
    expect(detectarTipo(bytesPdf())).toBe('application/pdf');
    expect(detectarTipo(bytesEpub())).toBe('application/epub+zip');
    expect(detectarTipo(bytesMp3())).toBe('audio/mpeg');
    expect(detectarTipo(bytesM4a())).toBe('audio/mp4');
  });

  it('não reconhece o que não é dos formatos — e falha fechada', () => {
    expect(detectarTipo(bytesHtml())).toBeNull();
    expect(detectarTipo(bytesSvg())).toBeNull();
    expect(detectarTipo(Buffer.from('só texto'))).toBeNull();
    expect(detectarTipo(Buffer.alloc(0))).toBeNull();
    expect(detectarTipo(Buffer.alloc(4096))).toBeNull();
  });

  it('ZIP que não é EPUB não passa por EPUB', () => {
    // Um .zip qualquer começa igual: PK\x03\x04. O que separa é o `mimetype`
    // sem compressão no deslocamento 30, exigido pelo OCF.
    const zipQualquer = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.alloc(60),
    ]);
    expect(detectarTipo(zipQualquer)).toBeNull();
  });
});

describe('saveUpload — o tipo declarado não decide mais nada', () => {
  it('HTML declarado como PNG é recusado', async () => {
    await expect(
      store.saveUpload(arquivo('inocente.png', 'image/png', bytesHtml())),
    ).rejects.toMatchObject({ code: 'INVALID_MIME' });
  });

  it('SVG declarado como PNG é recusado — SVG executa script', async () => {
    await expect(
      store.saveUpload(arquivo('logo.png', 'image/png', bytesSvg())),
    ).rejects.toMatchObject({ code: 'INVALID_MIME' });
  });

  it('PDF declarado como imagem NÃO vira imagem na rota aberta', async () => {
    // A separação entre as duas listas é da ROTA. Declarar `image/png` sobre um
    // PDF não pode dar ao aluno o que só a administração tem.
    await expect(
      store.saveUpload(arquivo('material.png', 'image/png', bytesPdf())),
    ).rejects.toMatchObject({ code: 'INVALID_MIME' });
  });

  it('PNG declarado como PDF é gravado como .png — vale o conteúdo', async () => {
    const r = await store.saveUpload(arquivo('x.pdf', 'application/pdf', bytesPng()));
    expect(r.mime).toBe('image/png');
    expect(r.filename).toMatch(/\.png$/);
  });

  it('a extensão gravada em disco vem do conteúdo, não do nome nem do rótulo', async () => {
    const r = await store.saveUpload(
      arquivo('foto.gif.exe', 'application/octet-stream', bytesJpeg()),
    );
    expect(r.filename).toMatch(/^[a-f0-9]{24}\.jpg$/);
    const st = await fs.stat(path.join(store.uploadsDir(), r.filename));
    expect(st.size).toBe(bytesJpeg().length);
  });

  it('documento de verdade continua passando para a administração', async () => {
    for (const [bytes, mime, ext] of [
      [bytesPdf(), 'application/pdf', '.pdf'],
      [bytesEpub(), 'application/epub+zip', '.epub'],
      [bytesMp3(), 'audio/mpeg', '.mp3'],
      [bytesM4a(), 'audio/mp4', '.m4a'],
    ] as const) {
      const r = await store.saveUpload(arquivo('material' + ext, mime, bytes), {
        permiteDocumento: true,
      });
      expect(r.mime).toBe(mime);
      expect(r.filename.endsWith(ext)).toBe(true);
    }
  });

  it('e imagem de verdade continua passando para qualquer pessoa logada', async () => {
    for (const [bytes, mime] of [
      [bytesPng(), 'image/png'],
      [bytesJpeg(), 'image/jpeg'],
      [bytesGif(), 'image/gif'],
      [bytesWebp(), 'image/webp'],
    ] as const) {
      const r = await store.saveUpload(arquivo('avatar', mime, bytes));
      expect(r.mime).toBe(mime);
    }
  });

  it('o limite de tamanho continua sendo conferido ANTES de ler os bytes', async () => {
    // Ler o conteúdo para decidir o tipo só é seguro porque o tamanho barra
    // antes: sem isso, a leitura viraria o próprio ataque.
    const enorme = new File([new Uint8Array(6 * 1024 * 1024)], 'grande.png', {
      type: 'image/png',
    });
    await expect(store.saveUpload(enorme)).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
    });
  });
});
