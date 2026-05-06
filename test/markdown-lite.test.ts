import { describe, it, expect } from 'vitest';
import { renderMarkdownLite } from '../src/app/components/MarkdownLite';

describe('renderMarkdownLite — escape', () => {
  it('escapa < > & " antes de processar', () => {
    const out = renderMarkdownLite('<script>alert("xss")</script>');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
    expect(out).toContain('&quot;xss&quot;');
  });

  it('preserva texto plano em <p>', () => {
    const out = renderMarkdownLite('hello world');
    expect(out).toContain('<p');
    expect(out).toContain('hello world');
  });
});

describe('renderMarkdownLite — inline', () => {
  it('bold com **', () => {
    const out = renderMarkdownLite('texto **forte** comum');
    expect(out).toContain('<strong>forte</strong>');
  });

  it('italic com *', () => {
    const out = renderMarkdownLite('texto *grifo* comum');
    expect(out).toContain('<em>grifo</em>');
  });

  it('code inline com `', () => {
    const out = renderMarkdownLite('use `npm install`');
    expect(out).toContain('<code');
    expect(out).toContain('npm install');
  });

  it('link com [text](url) https aceito', () => {
    const out = renderMarkdownLite('vai [aqui](https://exemplo.com)');
    expect(out).toContain('href="https://exemplo.com"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('aqui</a>');
  });

  it('link com javascript: vira href="#"', () => {
    const out = renderMarkdownLite('[click](javascript:alert(1))');
    expect(out).toContain('href="#"');
    expect(out).not.toContain('javascript:');
  });
});

describe('renderMarkdownLite — block', () => {
  it('h1/h2/h3 com #', () => {
    expect(renderMarkdownLite('# Título')).toContain('<h1');
    expect(renderMarkdownLite('## Sub')).toContain('<h2');
    expect(renderMarkdownLite('### Sub2')).toContain('<h3');
  });

  it('lista com -', () => {
    const out = renderMarkdownLite('- item 1\n- item 2');
    expect(out).toContain('<ul');
    expect(out).toContain('<li>item 1</li>');
    expect(out).toContain('<li>item 2</li>');
  });

  it('blockquote com >', () => {
    const out = renderMarkdownLite('> citação');
    expect(out).toContain('<blockquote');
    expect(out).toContain('citação');
  });

  it('code block com ```', () => {
    const out = renderMarkdownLite('```\nconst x = 1;\n```');
    expect(out).toContain('<pre');
    expect(out).toContain('const x = 1');
  });

  it('linhas vazias separam parágrafos', () => {
    const out = renderMarkdownLite('linha 1\n\nlinha 2');
    const pCount = (out.match(/<p /g) ?? []).length;
    expect(pCount).toBeGreaterThanOrEqual(2);
  });
});

describe('renderMarkdownLite — combinação', () => {
  it('mistura inline e bloco', () => {
    const out = renderMarkdownLite(
      '# Anotações\n\n**Importante**: revisar `código` antes de [enviar](https://x.com)\n\n- item *italic*\n- item bold',
    );
    expect(out).toContain('<h1');
    expect(out).toContain('Anotações');
    expect(out).toContain('<strong>Importante</strong>');
    expect(out).toContain('<code');
    expect(out).toContain('href="https://x.com"');
    expect(out).toContain('<ul');
    expect(out).toContain('<em>italic</em>');
  });
});
