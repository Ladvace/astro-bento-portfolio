import sanitizeHtml from 'sanitize-html';

/** Preserve usable existing HTTP(S) URLs without inventing HTTPS equivalents. */
export function safeExternalUrl(value) {
  if (typeof value !== 'string' || /[\u0000-\u0020\u007f<>"\\]/.test(value)) return null;
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return value;
  } catch {
    return null;
  }
}

function safeHref(value) {
  const external = safeExternalUrl(value);
  if (external) return external;
  if (typeof value !== 'string') return null;
  if (/^mailto:[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) return value;
  if (/^(?:\/(?!\/)|#)[^\s<>"\\]*$/.test(value)) return value;
  return null;
}

function linkAttributes(href, title) {
  return {
    ...(href ? { href } : {}),
    ...(title ? { title } : {}),
    ...(safeExternalUrl(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
  };
}

/** Sanitize original CMS HTML, retaining its text and semantic structure. */
export function sanitizeArticleHtml(content) {
  return sanitizeHtml(typeof content === 'string' ? content : '', {
    allowedTags: [
      'header', 'section', 'article', 'div', 'span', 'p', 'br', 'hr',
      'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 's', 'del',
      'blockquote', 'cite', 'q', 'abbr', 'sub', 'sup', 'mark', 'small',
      'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'pre', 'code', 'kbd', 'samp',
      'table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      'figure', 'figcaption', 'img', 'a', 'iframe',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
      iframe: ['src', 'title', 'width', 'height', 'loading', 'referrerpolicy', 'allowfullscreen'],
      code: ['class'],
      th: ['scope', 'colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
      ol: ['start', 'reversed'],
      li: ['value'],
      abbr: ['title'],
    },
    allowedClasses: { code: [/^language-[a-z0-9_-]+$/i] },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowedSchemesByTag: { img: ['https'], iframe: ['https'] },
    allowProtocolRelative: false,
    allowedIframeHostnames: ['bi.romahomestore.com'],
    allowIframeRelativeUrls: false,
    transformTags: {
      // The component owns the sole h1; retain original body headings as h2.
      h1: () => ({ tagName: 'h2', attribs: {} }),
      a: (_tag, attrs) => ({ tagName: 'a', attribs: linkAttributes(safeHref(attrs.href), attrs.title) }),
      img: (_tag, attrs) => ({ tagName: 'img', attribs: { ...attrs, loading: 'lazy', decoding: 'async' } }),
      iframe: (_tag, attrs) => {
        const src = safeExternalUrl(attrs.src);
        const url = src ? new URL(src) : null;
        // Existing verified Metabase public endpoints only. Never upgrade HTTP.
        const trusted = url?.protocol === 'https:' && url.hostname === 'bi.romahomestore.com'
          && !url.port && /^\/public\/(question|dashboard)\/[a-z0-9-]+\/?$/i.test(url.pathname);
        if (!trusted) {
          return { tagName: 'a', attribs: linkAttributes(src), text: src || '' };
        }
        return {
          tagName: 'iframe',
          attribs: {
            src,
            title: attrs.title || 'Interactive dashboard',
            width: '100%',
            height: /^\d{2,4}$/.test(attrs.height || '') ? attrs.height : '600',
            loading: 'lazy',
            referrerpolicy: 'no-referrer',
            allowfullscreen: '',
          },
        };
      },
    },
  });
}

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => `<a href="${href}">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

/**
 * Minimal Markdown for CMS-authored policies: ##/### headings, paragraphs, - / 1. lists, **bold**, *italic*, [links](url).
 * Input is HTML-escaped first and the result is sanitized again, so editors cannot inject markup.
 */
export function renderMarkdown(source) {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let list = null;
  const flushParagraph = () => { if (paragraph.length) html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`); paragraph = []; };
  const flushList = () => { if (list) html.push(`<${list.tag}>${list.items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</${list.tag}>`); list = null; };
  for (const raw of lines) {
    const line = raw.trim();
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const item = line.match(/^(?:([-+])|(\d+)[.)])\s+(.*)$/);
    if (!line) { flushParagraph(); flushList(); continue; }
    if (heading) {
      flushParagraph(); flushList();
      const level = Math.min(Math.max(heading[1].length, 2), 4);
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
    } else if (item) {
      flushParagraph();
      const tag = item[1] ? 'ul' : 'ol';
      if (list && list.tag !== tag) flushList();
      list ??= { tag, items: [] };
      list.items.push(item[3]);
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph(); flushList();
  return sanitizeArticleHtml(html.join('\n'));
}
