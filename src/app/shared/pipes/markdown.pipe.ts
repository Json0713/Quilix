/**
 * @file markdown.pipe.ts
 * @description
 * Angular pipe that converts raw Markdown text to sanitized HTML with syntax
 * highlighting. Uses `marked` for parsing, `DOMPurify` for XSS-safe
 * sanitization, and `Prism.js` for code block highlighting.
 *
 * Security: DOMPurify strips ALL dangerous HTML (event handlers, data URIs,
 * javascript: links, etc.) while preserving the structural tags that `marked`
 * generates (p, strong, em, ul, ol, li, code, pre, h1-h6, a, blockquote, table, etc.).
 */

import { Pipe, PipeTransform } from '@angular/core';
import { marked } from 'marked';
import DOMPurify, { type Config as PurifyConfig } from 'dompurify';
import Prism from 'prismjs';

// ── Load common Prism language grammars ──────────────────────────────────────
// Prism core only includes "markup" (HTML), "css", "clike", and "javascript".
// These imports add support for the languages AI chatbots most commonly output.
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-docker';

// ── Configure marked ─────────────────────────────────────────────────────────
const renderer = new marked.Renderer();

// Custom code block renderer — applies Prism highlighting at parse time.
renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
    const language = lang && Prism.languages[lang] ? lang : 'markup';
    const grammar = Prism.languages[language];

    let highlighted: string;
    try {
        highlighted = grammar
            ? Prism.highlight(text, grammar, language)
            : escapeHtml(text);
    } catch {
        highlighted = escapeHtml(text);
    }

    const langLabel = lang || 'code';
    return `<div class="code-block"><div class="code-header"><span class="code-lang">${escapeHtml(langLabel)}</span></div><pre class="language-${escapeHtml(language)}"><code class="language-${escapeHtml(language)}">${highlighted}</code></pre></div>`;
};

// Inline code
renderer.codespan = function ({ text }: { text: string }) {
    return `<code class="inline-code">${text}</code>`;
};

// Links open in new tab
renderer.link = function ({ href, text }: { href: string; text: string }) {
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
};

marked.setOptions({
    renderer,
    breaks: true,      // GFM line breaks
    gfm: true,         // GitHub Flavored Markdown
});

// ── DOMPurify config ─────────────────────────────────────────────────────────
const PURIFY_CONFIG: PurifyConfig = {
    ALLOWED_TAGS: [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'blockquote',
        'pre', 'code', 'div', 'span',
        'a',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'hr',
    ],
    ALLOWED_ATTR: [
        'class', 'href', 'target', 'rel',
    ],
    ALLOW_DATA_ATTR: false,
    // Aggressive: strip anything not explicitly allowed
    KEEP_CONTENT: true,
};

// ── Helper ───────────────────────────────────────────────────────────────────
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Pipe ─────────────────────────────────────────────────────────────────────
@Pipe({
    name: 'markdown',
    standalone: true,
    pure: true,
})
export class MarkdownPipe implements PipeTransform {

    transform(value: string | null | undefined): string {
        if (!value) return '';

        // 1. Parse markdown → raw HTML
        const rawHtml = marked.parse(value, { async: false }) as string;

        // 2. Sanitize — strips XSS vectors while keeping structural tags + Prism classes
        const cleanHtml = DOMPurify.sanitize(rawHtml, PURIFY_CONFIG);

        return cleanHtml as string;
    }
}
