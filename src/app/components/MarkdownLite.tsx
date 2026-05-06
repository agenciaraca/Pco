// Renderizador markdown minimal — sem deps. Suporta:
// **bold**, *italic*, `code`, # h1-h3, - lista, > quote, links [t](url),
// ``` code block ```, paragraph breaks.
// Faz escape de HTML antes pra evitar XSS.

import { useMemo } from 'react';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function applyInline(line: string): string {
  // Já escapado
  let s = line;
  // Code inline
  s = s.replace(
    /`([^`\n]+)`/g,
    '<code class="px-1 py-0.5 rounded bg-surface-mute text-pco-deep text-[12px]">$1</code>',
  );
  // Bold
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  // Italic — evita conflito com bold
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  // Links [text](url) — só http/https/mailto/relative
  s = s.replace(
    /\[([^\]\n]+)\]\(([^)\n]+)\)/g,
    (_full, text: string, url: string) => {
      const safe = /^(https?:\/\/|mailto:|\/)/.test(url) ? url : '#';
      return `<a href="${safe}" target="_blank" rel="noreferrer" class="text-pco-blue underline">${text}</a>`;
    },
  );
  return s;
}

export function renderMarkdownLite(input: string): string {
  const escaped = escapeHtml(input);
  const lines = escaped.split('\n');
  const out: string[] = [];
  let inList = false;
  let inCode = false;
  let codeBuf: string[] = [];

  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };
  const flushCode = () => {
    out.push(
      `<pre class="bg-surface-mute p-2 rounded text-[11px] font-mono overflow-x-auto"><code>${codeBuf.join('\n')}</code></pre>`,
    );
    codeBuf = [];
    inCode = false;
  };

  for (const raw of lines) {
    if (inCode) {
      if (raw.trim() === '```') {
        flushCode();
      } else {
        codeBuf.push(raw);
      }
      continue;
    }
    if (raw.trim() === '```') {
      closeList();
      inCode = true;
      continue;
    }
    if (/^\s*$/.test(raw)) {
      closeList();
      continue;
    }
    const h3 = /^###\s+(.+)$/.exec(raw);
    if (h3) {
      closeList();
      out.push(`<h3 class="text-sm font-bold text-pco-deep mt-3">${applyInline(h3[1]!)}</h3>`);
      continue;
    }
    const h2 = /^##\s+(.+)$/.exec(raw);
    if (h2) {
      closeList();
      out.push(`<h2 class="text-base font-bold text-pco-deep mt-3">${applyInline(h2[1]!)}</h2>`);
      continue;
    }
    const h1 = /^#\s+(.+)$/.exec(raw);
    if (h1) {
      closeList();
      out.push(`<h1 class="text-lg font-bold text-pco-deep mt-3">${applyInline(h1[1]!)}</h1>`);
      continue;
    }
    const li = /^\s*[-*]\s+(.+)$/.exec(raw);
    if (li) {
      if (!inList) {
        out.push('<ul class="list-disc ml-5 my-1 space-y-0.5">');
        inList = true;
      }
      out.push(`<li>${applyInline(li[1]!)}</li>`);
      continue;
    }
    // > é escapado para &gt; antes deste parser
    const quote = /^&gt;\s+(.+)$/.exec(raw);
    if (quote) {
      closeList();
      out.push(
        `<blockquote class="border-l-2 border-pco-blue/40 pl-3 italic text-ink-muted my-1">${applyInline(quote[1]!)}</blockquote>`,
      );
      continue;
    }
    closeList();
    out.push(`<p class="my-1">${applyInline(raw)}</p>`);
  }
  if (inCode) flushCode();
  closeList();
  return out.join('\n');
}

export default function MarkdownLite({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  const html = useMemo(() => renderMarkdownLite(source), [source]);
  return (
    <div
      className={`text-sm text-ink-muted leading-relaxed ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
