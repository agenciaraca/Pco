/**
 * O acervo importado não pode atribuir a obra errada ao autor errado.
 *
 * A biblioteca do LMS antigo traz o autor dentro do título, depois de um
 * travessão — mas em **duas ordens diferentes**, e o acervo tem as duas:
 *
 *   "Os Arquétipos e o Inconsciente Coletivo — Carl G. Jung"   (obra, autor)
 *   "Sigmund Freud — Luto e Melancolia"                        (autor, obra)
 *
 * A primeira versão do separador assumia sempre "obra — autor", e o ensaio da
 * importação mostrou o resultado antes de qualquer gravação: **autor "Luto e
 * Melancolia"**. Foi o ensaio que pegou, e é por isso que ele existe.
 *
 * Nenhuma regra de FORMA separa os dois casos: "Luto e Melancolia" e
 * "J. Fadiman e R. Frager" têm a mesma cara — duas partes ligadas por "e". O
 * que separa é reconhecer o nome, e por isso a lista de autores é o coração
 * disto.
 *
 * **A regra que mais importa é a terceira**: quando nenhum lado é
 * reconhecível, o separador NÃO escolhe. Título inteiro, curadoria da escola.
 * Atribuir obra a autor errado é um erro que ninguém percebe lendo a lista e
 * que corrói a credibilidade de uma biblioteca de formação; ficar sem a
 * separação custa uma coluna menos precisa.
 */
import { describe, it, expect } from 'vitest';
import { separarTituloEAutor } from '../scripts/importar_do_portalpco';

describe('separar obra e autor', () => {
  it('desfaz a ordem invertida quando o autor vem primeiro', () => {
    // O caso que o ensaio pegou.
    const r = separarTituloEAutor('Sigmund Freud – Luto e Melancolia');
    expect(r.autor).toBe('Sigmund Freud');
    expect(r.titulo).toBe('Luto e Melancolia');
  });

  it('mantém a ordem normal quando o autor vem depois', () => {
    const r = separarTituloEAutor('Os Arquetipos e o Inconsciente Coletivo - Carl G. Jung');
    expect(r.autor).toBe('Carl G. Jung');
    expect(r.titulo).toBe('Os Arquetipos e o Inconsciente Coletivo');
  });

  it('inicial abreviada é sinal de pessoa, mesmo sem nome conhecido', () => {
    // "J. Fadiman e R. Frager" tem a mesma forma de "Luto e Melancolia" —
    // duas partes ligadas por "e". O que decide é o ponto da abreviatura.
    const r = separarTituloEAutor('Teorias da Personalidade - J. Fadiman e R. Frager');
    expect(r.autor).toBe('J. Fadiman e R. Frager');
    expect(r.titulo).toBe('Teorias da Personalidade');
  });

  it('nome completo sem abreviatura também é reconhecido pela lista', () => {
    const r = separarTituloEAutor('Compêndio de psicanálise e outros escritos - Freud');
    expect(r.autor).toBe('Freud');
    expect(r.titulo).toBe('Compêndio de psicanálise e outros escritos');
  });

  it('o autor não pode ser o ASSUNTO da obra', () => {
    // O segundo caso que o ensaio pegou. "A associação livre em Freud…" contém
    // o nome, mas Freud é sobre quem a obra fala — não quem a escreveu. O que
    // separa os dois é o nome ocupar o lado quase inteiro.
    const r = separarTituloEAutor(
      'A associação livre em Freud, fundamento do tratamento psicanalítico - Luciano Antunes Figueiredo Sousa',
    );
    expect(r.autor).toBe('Luciano Antunes Figueiredo Sousa');
    expect(r.titulo).toContain('A associação livre em Freud');
  });

  it('nome próprio curto depois de título longo é reconhecido', () => {
    const r = separarTituloEAutor(
      'A Clinica Psicanalitica no Front de Guerra as Drogas - Daniela Santos Bezerra',
    );
    expect(r.autor).toBe('Daniela Santos Bezerra');
  });

  it('subtítulo não é confundido com nome próprio', () => {
    // "Uma Introdução" tem duas palavras capitalizadas, igual a um nome. O
    // artigo à frente é o que separa os dois.
    const r = separarTituloEAutor('A Escuta Clínica e o Tempo do Sujeito - Uma Introdução');
    expect(r.autor).toBe('Acervo PCO');
  });

  it('quando não dá para saber, NÃO inventa — título inteiro', () => {
    // A regra que protege o acervo. Nenhum lado é nome reconhecível nem traz
    // abreviatura: escolher aqui seria chutar.
    const r = separarTituloEAutor('A Escuta Clínica e o Tempo - Uma Introdução');
    expect(r.titulo).toBe('A Escuta Clínica e o Tempo - Uma Introdução');
    expect(r.autor).toBe('Acervo PCO');
  });

  it('parte da obra não vira autor', () => {
    // "Cap1", "Volume 4", "2019" aparecem depois do travessão no acervo real.
    for (const t of [
      'A Interpretação dos Sonhos - Volume 4',
      'Teorias da personalidade - Cap1',
      'Psicoterapias: Abordagens Atuais - 4a Edição',
    ]) {
      const r = separarTituloEAutor(t);
      expect(r.autor, `"${t}" separou parte da obra como autor`).toBe('Acervo PCO');
    }
  });

  it('título sem travessão fica inteiro', () => {
    const r = separarTituloEAutor('Teorias da personalidade Cap1');
    expect(r.titulo).toBe('Teorias da personalidade Cap1');
    expect(r.autor).toBe('Acervo PCO');
  });

  it('o autor nunca sai vazio — o campo é obrigatório na biblioteca', () => {
    for (const t of ['', '   ', '-', 'Obra -', '- Autor']) {
      const r = separarTituloEAutor(t);
      expect(r.autor.trim().length, `"${t}" deixou o autor vazio`).toBeGreaterThan(0);
    }
  });

  it('desescapa o que o WordPress entrega escapado', () => {
    // O WP devolve o título já renderizado para HTML; gravar assim faria o
    // aluno ler "&#8211;" na lista da biblioteca.
    const r = separarTituloEAutor('Luto e Melancolia &#8211; Sigmund Freud');
    expect(r.titulo + r.autor).not.toContain('&#');
    expect(r.autor).toBe('Sigmund Freud');
  });
});
