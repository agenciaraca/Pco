/**
 * Configuração do site público (institucional/comércio/blog).
 *
 * Dados de organização e responsável técnico. São conteúdo *público* por
 * definição — nada aqui pode conter segredo, PII de aluno ou dado operacional.
 * Editável pelo dono do projeto; no futuro pode migrar para settings no DB.
 *
 * Fonte: handoff de design (data/site.js), adaptado ao AVA.
 */

export interface OrgConfig {
  name: string;
  shortName: string;
  legalName: string;
  /** URL canônica do site público (produção). */
  url: string;
  logo: string;
  cnpj?: string;
  rntp?: string;
  founded?: string;
  email: string;
  phones: string[];
  whatsapp: string;
  address: {
    street: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
  };
  social: { facebook?: string; instagram?: string; linkedin?: string };
  slogan: string;
}

export const ORG: OrgConfig = {
  name: 'Psicanálise Clínica Online (PCO)',
  shortName: 'PCO',
  legalName: 'PCO — Psicanálise Clínica Online',
  // Domínio de produção do AVA. Ajustar se o site público subir em domínio próprio.
  url: 'https://ava.psicanaliseclinica.online',
  logo: '/uploads/logo-pco.png',
  cnpj: '41.961.134/0001-56',
  rntp: 'RNTP 1407167IE',
  founded: '2018',
  email: 'falecompco@gmail.com',
  phones: ['(11) 98401-0715', '(11) 97123-0714'],
  whatsapp: 'https://api.whatsapp.com/send?phone=5511984010715',
  address: {
    street: 'Av. Vital Brasil, 305, Butantã',
    city: 'São Paulo',
    region: 'SP',
    postalCode: '05503-001',
    country: 'BR',
  },
  social: {
    facebook: 'https://facebook.com/psicanalise.online.curso',
    instagram: 'https://instagram.com/cursopsicanaliseclinica',
  },
  slogan: 'A escolha inteligente para estudar psicanálise clínica.',
};

export interface AuthorConfig {
  slug: string;
  name: string;
  honorific: string;
  photo: string;
  credentials: string[];
  jobTitle: string;
  bio: string;
  experience: string;
  sameAs: string[];
}

/**
 * Quem assina o conteúdo: a **organização**, não uma pessoa.
 *
 * A PCO constrói curso com equipe — pedagogos, psicanalistas, redatores e
 * editores — e não com um docente de vitrine. Autoria institucional é o que
 * descreve isso com honestidade, e o schema.org tem entidade própria para ela
 * (`Organization`), que já é emitida como `publisher` em toda página.
 *
 * O que havia aqui antes era um molde de pessoa: "Dra. [Nome do Responsável
 * Técnico]", com credenciais inventadas ("Especialização em Saúde Mental",
 * "Coordenação pedagógica da PCO desde 2018") esperando alguém trocar só o
 * nome. Em conteúdo YMYL de saúde mental, esse é o tipo de arquivo que vira
 * publicação acidental de formação atribuída a quem não a tem. O molde saiu.
 *
 * **Se um dia houver responsável técnico nomeado**, preencha `AUTHOR` com uma
 * pessoa real — nome, foto e `sameAs` verificáveis — e a autoria por pessoa
 * volta a valer sozinha, sem mudar mais nada. Enquanto for `null`, o site omite
 * `/autor`, não emite nó `Person` e atribui a autoria à organização.
 */
export const AUTHOR: AuthorConfig | null = null;

/**
 * `true` enquanto não houver pessoa nomeada assinando o conteúdo.
 *
 * O nome ficou por compatibilidade: metade do site público já pergunta por ele
 * para decidir se emite `Person` ou cai na organização, e renomear seria trocar
 * um contrato público por gosto. O que ele significa hoje é "a autoria é
 * institucional".
 *
 * Também continua verdadeiro se alguém repuser um molde com `[colchetes]` no
 * nome — o detector antigo segue de pé para esse caso.
 */
// O cast existe porque, com `AUTHOR` literalmente `null`, o TypeScript estreita
// o outro lado do `||` para `never`. A expressão continua correta no dia em que
// alguém puser uma pessoa aqui — e é justamente esse dia que ela precisa cobrir.
export const AUTHOR_IS_PLACEHOLDER: boolean =
  AUTHOR === null || /\[.*\]/.test((AUTHOR as AuthorConfig).name);

/** Atalho legível: a autoria do site é da organização? */
export const AUTORIA_INSTITUCIONAL = AUTHOR_IS_PLACEHOLDER;

/** Disclaimer YMYL padrão — obrigatório em cursos e artigos (saúde mental). */
export const YMYL_DISCLAIMER =
  'Formação livre em psicanálise clínica. Não substitui graduação em Psicologia ou Medicina, nem constitui aconselhamento clínico. Em caso de crise, ligue para o CVV: 188.';
