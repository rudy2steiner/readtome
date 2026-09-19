import { readFile } from 'node:fs/promises';

const files = process.argv.slice(2);
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  '../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url,
).href;

const CJK = /[\u4e00-\u9fff]/;
const gx = (i) => i.transform?.[4] ?? 0;
const gy = (i) => i.transform?.[5] ?? 0;
const gh = (i) => i.height || Math.abs(i.transform?.[3] ?? 10);

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function detectGutter(glyphs) {
  const xs = [...new Set(glyphs.map(gx))].sort((a, b) => a - b);
  if (xs.length < 4) return null;
  const edges = glyphs.map((i) => gx(i) + Math.min(i.width || 0, 80)).sort((a, b) => a - b);
  const maxX = edges[Math.min(edges.length - 1, Math.floor(edges.length * 0.95))] || 0;
  for (let i = 1; i < xs.length; i += 1) {
    if (xs[i] > maxX * 0.32) break;
    const gap = xs[i] - xs[i - 1];
    if (gap >= 20) return (xs[i] + xs[i - 1]) / 2;
  }
  return null;
}

function joinRow(row) {
  let line = '';
  let prevEnd = Number.NEGATIVE_INFINITY;
  for (const part of row.parts) {
    const gap = part.x - prevEnd;
    if (line && gap > Math.max(row.height * 0.25, 1)) {
      const adjacentCjk = CJK.test(line.slice(-1)) && CJK.test(part.str.charAt(0));
      if (!adjacentCjk || gap > row.height * 1.2) line += gap > row.height * 4 ? '   ' : ' ';
    }
    line += part.str;
    prevEnd = part.x + part.width;
  }
  return line.replace(/[ \t]+$/g, '').replace(/[ \t]{2,}/g, ' ').trim();
}

function collectRows(glyphs, gutter) {
  const rows = [];
  for (const item of glyphs) {
    const y = gy(item);
    const height = gh(item);
    const col = gutter != null && gx(item) < gutter ? 'L' : 'R';
    let row = rows.find((r) => r.col === col && Math.abs(r.y - y) <= Math.max(r.height, height) * 0.4);
    if (!row) {
      row = { y, height, col, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x: gx(item), width: item.width || 0, str: item.str });
  }
  rows.forEach((r) => r.parts.sort((a, b) => a.x - b.x));
  return rows.filter((r) => joinRow(r)).sort((a, b) => b.y - a.y || (a.col === 'L' ? -1 : 1));
}

function mergeTitles(left) {
  const groups = [];
  for (const row of left) {
    const group = groups[groups.length - 1];
    if (group && group[group.length - 1].y - row.y <= Math.max(row.height, 10) * 2) group.push(row);
    else groups.push([row]);
  }
  return groups.map((group) => {
    const parts = group.map(joinRow);
    return { y: group.reduce((s, r) => s + r.y, 0) / group.length, text: parts.join(CJK.test(parts.join('')) ? '' : ' ') };
  });
}

function emitBlock(rows, normalGap) {
  const lines = [];
  rows.forEach((row, i) => {
    if (i > 0 && rows[i - 1].y - row.y > Math.max(normalGap * 1.6, row.height * 1.8)) lines.push('');
    lines.push(joinRow(row));
  });
  return lines;
}

function railSections(left, right) {
  const titles = mergeTitles(left);
  const gaps = right.slice(1).map((row, i) => right[i].y - row.y).filter((g) => g > 0);
  const normalGap = median(gaps) || right[0]?.height || 12;
  const claimed = right.map(() => -1);
  titles.forEach((title, titleIndex) => {
    let nearest = -1;
    let nearestDist = Infinity;
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
    for (let i = nearest - 1; i >= 0; i -= 1) {
      if (claimed[i] !== -1 || right[i].y - right[i + 1].y > normalGap + 0.5) break;
      claimed[i] = titleIndex;
    }
    for (let i = nearest + 1; i < right.length; i += 1) {
      if (claimed[i] !== -1 || right[i - 1].y - right[i].y > normalGap + 0.5) break;
      claimed[i] = titleIndex;
    }
  });
  const header = [];
  const bodies = titles.map(() => []);
  let current = -1;
  right.forEach((row, index) => {
    if (claimed[index] !== -1) current = claimed[index];
    if (current === -1) header.push(row);
    else bodies[current].push(row);
  });
  const out = [];
  if (header.length) out.push(...emitBlock(header, normalGap), '');
  titles.forEach((title, i) => {
    if (title.text) out.push(title.text);
    if (bodies[i].length) out.push(...emitBlock(bodies[i], normalGap));
    out.push('');
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function reconstruct(items) {
  const glyphs = items.filter((i) => i && i.str);
  const gutter = detectGutter(glyphs);
  const rows = collectRows(glyphs, gutter);
  const left = rows.filter((r) => r.col === 'L');
  const right = rows.filter((r) => r.col === 'R');
  if (gutter != null && left.length >= 2 && left.every((r) => joinRow(r).length <= 12) && right.length) {
    return railSections(left, right);
  }
  const lines = [];
  rows.forEach((row, index) => {
    if (index > 0) {
      const prev = rows[index - 1];
      if (row.col === 'L' || prev.col === 'L' || prev.y - row.y > row.height * 1.8) lines.push('');
    }
    lines.push(joinRow(row));
  });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

for (const file of files) {
  const data = new Uint8Array(await readFile(file));
  const doc = await pdfjs.getDocument({ data, disableWorker: true }).promise;
  console.log('\n====', file.split('/').pop(), 'pages', doc.numPages, '====');
  for (let i = 1; i <= Math.min(doc.numPages, 2); i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const next = reconstruct(content.items);
    console.log('page', i, 'newlines', (next.match(/\n/g) || []).length);
    console.log(next);
    console.log('---');
  }
}
