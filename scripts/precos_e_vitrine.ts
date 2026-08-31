/**
 * Preço dos cursos e quem aparece na vitrine.
 *
 * ## Por que existe
 *
 * Até 31/ago/2026 **nenhum curso do AVA tinha preço**: todos mostravam
 * "Consulte" e o checkout recusava com `NOT_FOR_SALE`, porque não havia produto
 * ativo ligado ao curso. Era o item que travava a receita.
 *
 * ## De onde vem cada número — nenhum foi inventado
 *
 * Os valores são os que a loja **está cobrando agora** em
 * `old.psicanaliseclinica.online`, lidos da API pública do WooCommerce
 * (`/wp-json/wc/store/v1/products`) em 31/ago/2026. Não são o preço cheio: a
 * loja está com promoção ativa, e cobrar diferente nos dois canais ao mesmo
 * tempo seria armadilha para o comprador.
 *
 * O `price: 1497` que aparece no protótipo de design é **maquete** e nunca
 * atravessa — a regra está no CLAUDE.md.
 *
 * O mapeamento produto-da-loja → curso vem de
 * `data/migration/product-to-course-map.json`, gerado na migração.
 *
 * ## O que ele faz
 *
 * 1. Cria (ou atualiza) um produto ativo `kind: 'course'` por curso com preço.
 * 2. Tira da vitrine pública os cursos que a escola não vende — `publicListed:
 *    false` esconde do visitante e **preserva o acesso de quem já comprou**.
 *
 * É idempotente: rodar duas vezes não duplica produto nem muda mais nada.
 *
 * ## Uso
 *
 *   npx tsx scripts/precos_e_vitrine.ts             # ensaio: só mostra
 *   npx tsx scripts/precos_e_vitrine.ts --commit    # grava
 *
 * Contra produção, rode no servidor (o `.env` de lá tem o `DATABASE_URL` e o
 * `data/` dos produtos) e reinicie o pm2 depois.
 */

import 'dotenv/config';
import * as coursesRepo from '../server/repositories/courses';
import * as productsRepo from '../server/payments/products-repo';

const COMMIT = process.argv.includes('--commit');

/** Preço medido na loja em 31/ago/2026, em centavos. */
interface PrecoDecidido {
  slug: string;
  precoCents: number;
  cheioCents: number;
  wcProductId: string;
}

const PRECOS: PrecoDecidido[] = [
  {
    slug: 'curso-de-psicanalise-clinica-online',
    precoCents: 119_860,
    cheioCents: 349_650,
    wcProductId: '8034',
  },
  {
    slug: 'terapia-familiar-sistemica',
    precoCents: 119_860,
    cheioCents: 219_650,
    wcProductId: '13464',
  },
  {
    // A loja vende como "Curso de Hipnoterapia Clínica" (WC 8258 → curso 8748).
    // No AVA o slug é `hipnoterapia` — e há mais de um curso com ele, resíduo
    // da importação. Slug ambíguo é pulado, não adivinhado: preço no curso
    // errado cobra o valor errado de gente de verdade.
    slug: 'hipnoterapia',
    precoCents: 59_940,
    cheioCents: 119_980,
    wcProductId: '8258',
  },
];

/** Cursos sem produto na loja: saem da vitrine em vez de ficar em "Consulte". */
const FORA_DA_VITRINE = ['como-ser-um-super-aluno-online', 'treinamento-em-atendimento-e-relacionamento-com-o-cliente-pco'];

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function main() {
  const cursos = await coursesRepo.listCourses();
  console.log(`\n${COMMIT ? '>> GRAVANDO' : '>> ENSAIO (nada é gravado)'}\n`);
  console.log(`Cursos na base: ${cursos.length}\n`);

  // Slug NÃO é único nesta base: a importação deixou duplicatas (`hipnoterapia`
  // aparece duas vezes, `como-ser-um-super-aluno-online` tem um irmão `-2`).
  // Um Map comum guardaria o último e escolheria em silêncio — daí a lista.
  const porSlug = new Map<string, unknown[]>();
  for (const c of cursos) {
    const s = String((c as { slug?: string }).slug ?? '');
    porSlug.set(s, [...(porSlug.get(s) ?? []), c]);
  }
  const um = (slug: string): Record<string, unknown> | 'ausente' | 'ambiguo' => {
    const achados = porSlug.get(slug);
    if (!achados || achados.length === 0) return 'ausente';
    if (achados.length > 1) return 'ambiguo';
    return achados[0] as Record<string, unknown>;
  };
  const naoEncontrados: string[] = [];

  // ---------- 1. preço ----------
  console.log('--- PREÇO ---');
  for (const alvo of PRECOS) {
    const curso = um(alvo.slug);
    if (curso === 'ausente' || curso === 'ambiguo') {
      naoEncontrados.push(alvo.slug);
      console.log(
        `  ?  ${alvo.slug}: ${curso === 'ausente' ? 'não existe na base' : 'mais de um curso com este slug'} — nada feito`,
      );
      continue;
    }
    const id = String((curso as { id: string }).id);
    const titulo = String((curso as { title?: string }).title ?? alvo.slug);
    const jaTem = await productsRepo.findByCourseId(id);

    if (jaTem && jaTem.priceCents === alvo.precoCents) {
      console.log(`  =  ${titulo}: já está em ${brl(alvo.precoCents)} — nada a fazer`);
      continue;
    }

    if (jaTem) {
      console.log(
        `  ~  ${titulo}: ${brl(jaTem.priceCents)} -> ${brl(alvo.precoCents)} (produto ${jaTem.id})`,
      );
      if (COMMIT) await productsRepo.updateProduct(jaTem.id, { priceCents: alvo.precoCents, active: true });
      continue;
    }

    console.log(`  +  ${titulo}: criar produto ativo a ${brl(alvo.precoCents)} (curso ${id})`);
    if (COMMIT) {
      await productsRepo.createProduct({
        kind: 'course',
        refId: id,
        name: titulo,
        priceCents: alvo.precoCents,
        currency: 'BRL',
        active: true,
        metadata: {
          origem: 'loja-woocommerce',
          wcProductId: alvo.wcProductId,
          precoCheioCents: alvo.cheioCents,
          medidoEm: '2026-08-31',
        },
      });
    }
  }

  // ---------- 2. vitrine ----------
  console.log('\n--- VITRINE ---');
  for (const slug of FORA_DA_VITRINE) {
    const curso = um(slug);
    if (curso === 'ausente' || curso === 'ambiguo') {
      naoEncontrados.push(slug);
      console.log(
        `  ?  ${slug}: ${curso === 'ausente' ? 'não existe na base' : 'mais de um curso com este slug'} — nada feito`,
      );
      continue;
    }
    const id = String((curso as { id: string }).id);
    const titulo = String((curso as { title?: string }).title ?? slug);
    const jaEscondido = (curso as { publicListed?: boolean }).publicListed === false;
    if (jaEscondido) {
      console.log(`  =  ${titulo}: já está fora da vitrine`);
      continue;
    }
    console.log(`  -  ${titulo}: sai da vitrine pública (quem já comprou continua acessando)`);
    if (COMMIT) await coursesRepo.updateCourse(id, { publicListed: false });
  }

  if (naoEncontrados.length > 0) {
    console.log(`\nAVISO: slugs não encontrados: ${naoEncontrados.join(', ')}`);
    console.log('Slugs existentes:');
    for (const c of cursos) console.log(`  ${(c as { slug?: string }).slug}`);
  }

  console.log(
    COMMIT
      ? '\nGravado. Reinicie o processo para que a leitura em memória acompanhe.\n'
      : '\nEnsaio concluído. Repita com --commit para gravar.\n',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
