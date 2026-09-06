import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { saveUpload, ehTipoDeDocumento, UploadError } from '../server/uploads/store';

/**
 * A biblioteca não tinha upload — e o motivo de isso não ser trivial.
 *
 * O formulário do material tinha só um campo de texto, chamado `fileMockUrl`,
 * com padrão `'#'`. Ou seja: a biblioteca era um catálogo de links que alguém
 * tinha de hospedar em outro lugar. O upload existe no servidor desde sempre
 * (`POST /uploads`) — faltava o botão.
 *
 * **Mas ligar os dois direto seria um buraco.** `POST /uploads` é
 * `requireAuth()`, não `requireAuth('admin')`: todo aluno alcança. Imagem é o
 * caso que justifica isso (avatar). Liberar PDF ali deixaria qualquer aluno
 * hospedar arquivo no domínio da escola — que é exatamente o que golpe de
 * phishing procura, porque o domínio empresta credibilidade ao arquivo.
 *
 * Por isso são duas listas, e quem decide qual vale é a **rota**, nunca o
 * cliente.
 */

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-upload-'));
  process.env.DATA_DIR = tmpDir;
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

function arquivo(nome: string, mime: string, bytes = 16): File {
  return new File([new Uint8Array(bytes)], nome, { type: mime });
}

describe('documento é upload de administração, imagem é de todo mundo', () => {
  it('aluno não sobe PDF', async () => {
    await expect(saveUpload(arquivo('apostila.pdf', 'application/pdf'))).rejects.toBeInstanceOf(
      UploadError,
    );
  });

  it('e a administração sobe', async () => {
    const r = await saveUpload(arquivo('apostila.pdf', 'application/pdf'), {
      permiteDocumento: true,
    });
    expect(r.url).toMatch(/\.pdf$/);
    expect(r.mime).toBe('application/pdf');
  });

  it('imagem continua valendo para qualquer pessoa logada', async () => {
    const r = await saveUpload(arquivo('avatar.png', 'image/png'));
    expect(r.url).toMatch(/\.png$/);
  });

  it('SVG não entra em nenhuma das duas listas', async () => {
    // Não é esquecimento: SVG é documento que executa script, servido da mesma
    // origem que o resto do produto.
    expect(ehTipoDeDocumento('image/svg+xml')).toBe(false);
    await expect(
      saveUpload(arquivo('x.svg', 'image/svg+xml'), { permiteDocumento: true }),
    ).rejects.toBeInstanceOf(UploadError);
  });

  it('o limite de tamanho acompanha o tipo', async () => {
    // Apostila em PDF passa dos 5MB de um avatar; um avatar de 40MB não é
    // avatar. O limite grande vale só onde o tipo grande é permitido.
    const grande = arquivo('grande.png', 'image/png', 6 * 1024 * 1024);
    await expect(saveUpload(grande)).rejects.toBeInstanceOf(UploadError);

    const pdfGrande = arquivo('apostila.pdf', 'application/pdf', 6 * 1024 * 1024);
    const r = await saveUpload(pdfGrande, { permiteDocumento: true });
    expect(r.size).toBe(6 * 1024 * 1024);
  });

  it('a rota decide o que vale, e não o corpo da requisição', async () => {
    const fonte = await fs.readFile(path.join(process.cwd(), 'server', 'app.ts'), 'utf8');
    const i = fonte.indexOf("app.post('/uploads'");
    const bloco = fonte.slice(i, i + 1400);
    // O papel sai do token, nunca de um campo do formulário.
    expect(bloco).toMatch(/u\?\.role === 'admin'/);
    expect(bloco).toContain('permiteDocumento');
  });
});
