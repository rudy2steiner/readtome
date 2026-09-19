export const ACCEPT_UPLOAD =
  '.txt,.text,.md,.markdown,.html,.htm,.rtf,.csv,.tsv,.doc,.docx,.odt,.pdf,.epub,text/plain,text/markdown,text/html,text/csv,text/rtf,application/msword,application/pdf,application/epub+zip,application/rtf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text';

const MAX_BYTES = 15 * 1024 * 1024;

export type ExtractFail = 'unsupported' | 'legacy_doc' | 'empty' | 'too_large' | 'parse';

export type ExtractResult = { ok: true; text: string } | { ok: false; reason: ExtractFail };

export type ExtractProgress = {
  phase: 'ocr-init' | 'ocr';
  page: number;
  total: number;
  text: string;
};

export async function extractDocumentText(
  file: File,
  options?: { onProgress?: (progress: ExtractProgress) => void },
): Promise<ExtractResult> {
  if (file.size > MAX_BYTES) return { ok: false, reason: 'too_large' };

  const kind = detectKind(file);
  if (kind === 'legacy_doc') return { ok: false, reason: 'legacy_doc' };
  if (!kind) return { ok: false, reason: 'unsupported' };

  try {
    const text = (await readKind(file, kind, options)).replace(/\u0000/g, '').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) return { ok: false, reason: 'empty' };
    return { ok: true, text };
  } catch {
    return { ok: false, reason: 'parse' };
  }
}

type Kind = 'plain' | 'markdown' | 'html' | 'rtf' | 'docx' | 'odt' | 'pdf' | 'epub';

function detectKind(file: File): Kind | 'legacy_doc' | null {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (name.endsWith('.doc') && !name.endsWith('.docx')) return 'legacy_doc';
  if (name.endsWith('.docx') || type.includes('wordprocessingml')) return 'docx';
  if (name.endsWith('.odt') || type.includes('opendocument.text')) return 'odt';
  if (name.endsWith('.pdf') || type === 'application/pdf') return 'pdf';
  if (name.endsWith('.epub') || type === 'application/epub+zip') return 'epub';
  if (name.endsWith('.html') || name.endsWith('.htm') || type === 'text/html') return 'html';
  if (name.endsWith('.rtf') || type === 'text/rtf' || type === 'application/rtf') return 'rtf';
  if (name.endsWith('.md') || name.endsWith('.markdown') || type === 'text/markdown' || type === 'text/x-markdown') {
    return 'markdown';
  }
  if (
    name.endsWith('.txt') ||
    name.endsWith('.text') ||
    name.endsWith('.csv') ||
    name.endsWith('.tsv') ||
    type.startsWith('text/')
  ) {
    return 'plain';
  }
  return null;
}

async function readKind(
  file: File,
  kind: Kind,
  options?: { onProgress?: (progress: ExtractProgress) => void },
): Promise<string> {
  if (kind === 'plain') return file.text();
  if (kind === 'markdown') return markdownToText(await file.text());
  if (kind === 'html') return htmlToText(await file.text());
  if (kind === 'rtf') return rtfToText(await file.text());
  const buffer = await file.arrayBuffer();
  if (kind === 'docx') return readDocx(buffer);
  if (kind === 'odt') return readOdt(buffer);
  if (kind === 'pdf') return readPdf(buffer, options);
  return readEpub(buffer);
}

async function readDocx(buffer: ArrayBuffer): Promise<string> {
  const loaded = await import('mammoth/mammoth.browser');
  const mammoth = 'convertToHtml' in loaded ? loaded : loaded.default;
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
  return htmlToText(result.value);
}

async function readOdt(buffer: ArrayBuffer): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('content.xml')?.async('string');
  if (!xml) throw new Error('odt');
  return htmlToText(xml.replace(/<text:line-break\b[^/]*\/>/g, '\n').replace(/<text:p\b[^>]*>/g, '\n'));
}

async function readPdf(
  buffer: ArrayBuffer,
  options?: { onProgress?: (progress: ExtractProgress) => void },
): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const cdn = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}`;
  pdfjs.GlobalWorkerOptions.workerSrc = `${cdn}/build/pdf.worker.min.mjs`;
  const doc = await pdfjs.getDocument({
    data: buffer,
    cMapUrl: `${cdn}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${cdn}/standard_fonts/`,
  }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(pdfItemsToText(content.items));
  }
  const layerText = pages.join('\n\n').replace(/\u0000/g, '').replace(/\n{3,}/g, '\n\n').trim();
  if (layerText) return layerText;
  if (typeof document === 'undefined') return '';

  return ocrPdfPages(doc, options);
}

async function ocrPdfPages(
  doc: { numPages: number; getPage: (n: number) => Promise<any> },
  options?: { onProgress?: (progress: ExtractProgress) => void },
): Promise<string> {
  options?.onProgress?.({ phase: 'ocr-init', page: 0, total: doc.numPages, text: '' });
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('chi_sim+eng');
  const parts: string[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const canvas = await renderPdfPage(page);
      const { data } = await worker.recognize(canvas);
      const pageText = tidyOcrText(data.text || '');
      if (pageText) parts.push(pageText);
      options?.onProgress?.({
        phase: 'ocr',
        page: i,
        total: doc.numPages,
        text: parts.join('\n\n'),
      });
    }
  } finally {
    await worker.terminate();
  }
  return parts.join('\n\n');
}

async function renderPdfPage(page: {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (opts: { canvasContext: CanvasRenderingContext2D; canvas: HTMLCanvasElement; viewport: { width: number; height: number } }) => { promise: Promise<void> };
}): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const canvasContext = canvas.getContext('2d');
  if (!canvasContext) throw new Error('canvas');
  await page.render({ canvasContext, canvas, viewport }).promise;
  return canvas;
}

async function readEpub(buffer: ArrayBuffer): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);
  const hrefs = await epubSpine(zip);
  const parts: string[] = [];
  for (const href of hrefs) {
    const xml = await zip.file(href)?.async('string');
    if (xml) parts.push(htmlToText(xml));
  }
  if (parts.length) return parts.join('\n\n');

  const fallback: string[] = [];
  zip.forEach((path, entry) => {
    if (!entry.dir && /\.(x?html|htm)$/i.test(path)) fallback.push(path);
  });
  fallback.sort();
  for (const path of fallback) {
    const xml = await zip.file(path)?.async('string');
    if (xml) parts.push(htmlToText(xml));
  }
  return parts.join('\n\n');
}

async function epubSpine(zip: import('jszip')): Promise<string[]> {
  const container = await zip.file('META-INF/container.xml')?.async('string');
  if (!container) return [];
  const root = /full-path="([^"]+)"/.exec(container)?.[1];
  if (!root) return [];
  const opf = await zip.file(root)?.async('string');
  if (!opf) return [];
  const base = root.includes('/') ? root.slice(0, root.lastIndexOf('/') + 1) : '';
  const hrefById = new Map<string, string>();
  for (const match of opf.matchAll(/id="([^"]+)"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*id="([^"]+)"/g)) {
    const id = match[1] || match[4];
    const href = match[2] || match[3];
    if (id && href) hrefById.set(id, base + href);
  }
  const spine: string[] = [];
  for (const match of opf.matchAll(/idref="([^"]+)"/g)) {
    const href = hrefById.get(match[1]);
    if (href) spine.push(href);
  }
  return spine;
}

function tidyOcrText(text: string): string {
  return text
    .replace(/([\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const BLOCK_BREAK = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TR', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'BLOCKQUOTE', 'PRE', 'DT', 'DD', 'FIGCAPTION']);
const CJK_CHAR = /[\u4e00-\u9fff]/;

type PdfTextItem = {
  str: string;
  transform?: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
};

function isPdfTextItem(item: unknown): item is PdfTextItem {
  return Boolean(item && typeof item === 'object' && 'str' in item);
}

type PdfRow = { y: number; height: number; col: 'L' | 'R'; parts: { x: number; width: number; str: string }[] };

function glyphX(item: PdfTextItem): number {
  return item.transform?.[4] ?? 0;
}

function glyphY(item: PdfTextItem): number {
  return item.transform?.[5] ?? 0;
}

function glyphH(item: PdfTextItem): number {
  return item.height || Math.abs(item.transform?.[3] ?? 10);
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pageRightEdge(glyphs: PdfTextItem[]): number {
  const edges = glyphs
    .map((item) => glyphX(item) + Math.min(item.width || 0, 80))
    .sort((a, b) => a - b);
  return edges[Math.min(edges.length - 1, Math.floor(edges.length * 0.95))] || 0;
}

function detectGutter(glyphs: PdfTextItem[]): number | null {
  const xs = [...new Set(glyphs.map(glyphX))].sort((a, b) => a - b);
  if (xs.length < 4) return null;
  const maxX = pageRightEdge(glyphs);
  for (let i = 1; i < xs.length; i += 1) {
    if (xs[i] > maxX * 0.32) break;
    const gap = xs[i] - xs[i - 1];
    if (gap >= 20) return (xs[i] + xs[i - 1]) / 2;
  }
  return null;
}

function joinPdfRow(row: PdfRow): string {
  let line = '';
  let prevEnd = Number.NEGATIVE_INFINITY;
  for (const part of row.parts) {
    const gap = part.x - prevEnd;
    if (line && gap > Math.max(row.height * 0.25, 1)) {
      const adjacentCjk = CJK_CHAR.test(line.slice(-1)) && CJK_CHAR.test(part.str.charAt(0));
      if (!adjacentCjk || gap > row.height * 1.2) line += gap > row.height * 4 ? '   ' : ' ';
    }
    line += part.str;
    prevEnd = part.x + part.width;
  }
  return line.replace(/[ \t]+$/g, '').replace(/[ \t]{2,}/g, ' ').trim();
}

function collectPdfRows(glyphs: PdfTextItem[], gutter: number | null): PdfRow[] {
  const rows: PdfRow[] = [];
  for (const item of glyphs) {
    const y = glyphY(item);
    const height = glyphH(item);
    const col: 'L' | 'R' = gutter != null && glyphX(item) < gutter ? 'L' : 'R';
    let row = rows.find(
      (candidate) => candidate.col === col && Math.abs(candidate.y - y) <= Math.max(candidate.height, height) * 0.4,
    );
    if (!row) {
      row = { y, height, col, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x: glyphX(item), width: item.width || 0, str: item.str });
  }
  rows.forEach((row) => row.parts.sort((a, b) => a.x - b.x));
  return rows.filter((row) => joinPdfRow(row)).sort((a, b) => b.y - a.y || (a.col === 'L' ? -1 : 1));
}

function looksLikeLeftRail(left: PdfRow[]): boolean {
  return left.length >= 2 && left.every((row) => joinPdfRow(row).length <= 12);
}

function mergeStackedTitles(left: PdfRow[]): { y: number; text: string }[] {
  const groups: PdfRow[][] = [];
  for (const row of left) {
    const group = groups[groups.length - 1];
    if (group && group[group.length - 1].y - row.y <= Math.max(row.height, 10) * 2) group.push(row);
    else groups.push([row]);
  }
  return groups.map((group) => {
    const parts = group.map(joinPdfRow);
    const glue = CJK_CHAR.test(parts.join('')) ? '' : ' ';
    return { y: group.reduce((sum, row) => sum + row.y, 0) / group.length, text: parts.join(glue) };
  });
}

function emitRowBlock(rows: PdfRow[], normalGap: number): string[] {
  const lines: string[] = [];
  rows.forEach((row, index) => {
    if (index > 0 && rows[index - 1].y - row.y > Math.max(normalGap * 1.6, row.height * 1.8)) lines.push('');
    lines.push(joinPdfRow(row));
  });
  return lines;
}

function rowsToPlainLines(rows: PdfRow[]): string {
  const lines: string[] = [];
  rows.forEach((row, index) => {
    if (index > 0) {
      const prev = rows[index - 1];
      if (row.col === 'L' || prev.col === 'L' || prev.y - row.y > row.height * 1.8) lines.push('');
    }
    lines.push(joinPdfRow(row));
  });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Left-rail resume titles sit in the vertical middle of a section. Attach each
 * title to its body cluster, then emit title + body so the editor keeps sections.
 */
function rowsToRailSections(left: PdfRow[], right: PdfRow[]): string {
  const titles = mergeStackedTitles(left);
  const gaps = right.slice(1).map((row, index) => right[index].y - row.y).filter((gap) => gap > 0);
  const normalGap = median(gaps) || right[0]?.height || 12;
  const claimed = right.map(() => -1);

  titles.forEach((_, titleIndex) => {
    const title = titles[titleIndex];
    let nearest = -1;
    let nearestDist = Number.POSITIVE_INFINITY;
    right.forEach((row, index) => {
      if (claimed[index] !== -1) return;
      const dist = Math.abs(row.y - title.y);
      if (dist < nearestDist) {
        nearest = index;
        nearestDist = dist;
      }
    });
    if (nearest < 0) return;
    claimed[nearest] = titleIndex;
    for (let index = nearest - 1; index >= 0; index -= 1) {
      if (claimed[index] !== -1 || right[index].y - right[index + 1].y > normalGap + 0.5) break;
      claimed[index] = titleIndex;
    }
    for (let index = nearest + 1; index < right.length; index += 1) {
      if (claimed[index] !== -1 || right[index - 1].y - right[index].y > normalGap + 0.5) break;
      claimed[index] = titleIndex;
    }
  });

  const header: PdfRow[] = [];
  const bodies = titles.map(() => [] as PdfRow[]);
  let current = -1;
  right.forEach((row, index) => {
    if (claimed[index] !== -1) current = claimed[index];
    if (current === -1) header.push(row);
    else bodies[current].push(row);
  });

  const out: string[] = [];
  if (header.length) {
    out.push(...emitRowBlock(header, normalGap), '');
  }
  titles.forEach((title, index) => {
    if (title.text) out.push(title.text);
    if (bodies[index].length) out.push(...emitRowBlock(bodies[index], normalGap));
    out.push('');
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Rebuild lines from glyph positions. Left-rail titles stay on their own lines. */
function pdfItemsToText(items: unknown[]): string {
  const glyphs = items.filter(isPdfTextItem).filter((item) => item.str);
  if (!glyphs.length) return '';

  const gutter = detectGutter(glyphs);
  const rows = collectPdfRows(glyphs, gutter);
  const left = rows.filter((row) => row.col === 'L');
  const right = rows.filter((row) => row.col === 'R');
  if (gutter != null && looksLikeLeftRail(left) && right.length) return rowsToRailSections(left, right);
  return rowsToPlainLines(rows);
}

/** Drop YAML frontmatter and markdown markers so TTS reads the words, not `##` or `**`. */
export async function markdownToText(source: string): Promise<string> {
  let text = source.replace(/^\uFEFF/, '');
  if (text.startsWith('---')) {
    const end = text.indexOf('\n---', 3);
    if (end !== -1) text = text.slice(end + 4);
  }

  const { remark } = await import('remark');
  const html = (await import('remark-html')).default;
  const processed = await remark().use(html).process(text);
  return htmlToText(String(processed))
    .replace(/\*{2,}|_{2,}/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Keep paragraph, list and table row breaks that `textContent` would flatten. */
export function htmlToText(markup: string): string {
  const doc = new DOMParser().parseFromString(markup, 'text/html');
  doc.querySelectorAll('script,style,noscript').forEach((node) => node.remove());
  const parts: string[] = [];

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent || '');
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    if (el.tagName === 'BR') {
      parts.push('\n');
      return;
    }
    Array.from(el.childNodes).forEach(walk);
    if (el.tagName === 'TD' || el.tagName === 'TH') parts.push('  ');
    if (BLOCK_BREAK.has(el.tagName)) parts.push('\n');
  };

  walk(doc.body);
  return parts.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function rtfToText(rtf: string): string {
  return rtf
    .replace(/\\par[d]? ?/gi, '\n')
    .replace(/\\line ?/gi, '\n')
    .replace(/\\'[0-9a-f]{2}/gi, (token) => String.fromCharCode(parseInt(token.slice(2), 16)))
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/[{}]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}
