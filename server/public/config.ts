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
 * Responsável técnico — sinal central de E-E-A-T (conteúdo YMYL: saúde mental).
 * ⚠️ PLACEHOLDER: substituir por dados reais (nome, foto, credenciais, LinkedIn/Lattes).
 */
export const AUTHOR: AuthorConfig = {
  slug: 'coordenacao-pedagogica',
  name: 'Dra. [Nome do Responsável Técnico]',
  honorific: 'Psicanalista · Coordenação Pedagógica',
  photo: '',
  credentials: [
    'Formação em Psicanálise Clínica',
    'Especialização em Saúde Mental',
    'Coordenação pedagógica da PCO desde 2018',
  ],
  jobTitle: 'Coordenadora Pedagógica e Responsável Técnica',
  bio: 'Responsável técnica e coordenadora pedagógica da PCO, com atuação na formação de psicanalistas clínicos. Estrutura o conteúdo dos cursos com base em referências consolidadas — de Freud às abordagens contemporâneas — e é responsável pela curadoria dos materiais e pela revisão ética das aulas.',
  experience:
    'Mais de uma década dedicada ao ensino e à prática da psicanálise clínica, com centenas de alunos formados pela plataforma.',
  sameAs: [
    'https://instagram.com/cursopsicanaliseclinica',
    'https://facebook.com/psicanalise.online.curso',
  ],
};

/** Disclaimer YMYL padrão — obrigatório em cursos e artigos (saúde mental). */
export const YMYL_DISCLAIMER =
  'Formação livre em psicanálise clínica. Não substitui graduação em Psicologia ou Medicina, nem constitui aconselhamento clínico. Em caso de crise, ligue para o CVV: 188.';
