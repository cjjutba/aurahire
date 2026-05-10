export interface TextLayerItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const stripDiacritics = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const normalizeForCompare = (s: string) =>
  stripDiacritics(s).replace(/\s+/g, " ").trim().toLowerCase();
const stripAllPunctuation = (s: string) =>
  stripDiacritics(s).replace(/[^\w]/g, "").toLowerCase();

/**
 * Find rect(s) in the rendered text layer that match the source string.
 * Whitespace-tolerant, accent-insensitive, case-insensitive.
 * Returns null if not found.
 */
export function findTextSpans(
  items: TextLayerItem[],
  source: string,
): Rect[] | null {
  if (!source.trim() || items.length === 0) return null;

  // Strategy 1: build a normalized buffer with index→item mapping and search.
  let buffer = "";
  const charToItem: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const text = items[i]!.str;
    for (let c = 0; c < text.length; c++) {
      buffer += text[c];
      charToItem.push(i);
    }
    // Insert virtual space between items (they print with implicit spacing).
    buffer += " ";
    charToItem.push(-1);
  }

  const normalizedBuffer = normalizeForCompare(buffer);
  const normalizedSource = normalizeForCompare(source);
  const idx = normalizedBuffer.indexOf(normalizedSource);
  if (idx >= 0) {
    return spansFromCharRange(
      items,
      charToItem,
      buffer,
      idx,
      normalizedSource.length,
    );
  }

  // Strategy 2: punctuation-stripped match (handles "0976-455-6948" → "09764556948").
  const stripped = stripAllPunctuation(buffer);
  const strippedSrc = stripAllPunctuation(source);
  if (strippedSrc && stripped.includes(strippedSrc)) {
    for (let i = 0; i < items.length; i++) {
      if (stripAllPunctuation(items[i]!.str).includes(strippedSrc)) {
        const it = items[i]!;
        return [{ x: it.x, y: it.y, width: it.width, height: it.height }];
      }
    }
  }

  return null;
}

function spansFromCharRange(
  items: TextLayerItem[],
  charToItem: number[],
  buffer: string,
  startInNormalized: number,
  lengthInNormalized: number,
): Rect[] {
  // Walk the original buffer, counting normalized characters until we hit the start index.
  let normCount = 0;
  let startIdx = -1;
  for (let i = 0; i < buffer.length; i++) {
    const c = buffer[i]!;
    const isNormChar = /\w/.test(c);
    if (isNormChar) {
      if (normCount === startInNormalized) {
        startIdx = i;
        break;
      }
      normCount++;
    }
  }
  if (startIdx < 0) return [];

  // Walk forward to cover lengthInNormalized normalized chars.
  let endIdx = startIdx;
  let collected = 0;
  while (endIdx < buffer.length && collected < lengthInNormalized) {
    const c = buffer[endIdx]!;
    if (/\w/.test(c)) collected++;
    endIdx++;
  }

  // Collect distinct item indices covered by [startIdx, endIdx).
  const itemIndices = new Set<number>();
  for (let i = startIdx; i < endIdx; i++) {
    const ii = charToItem[i];
    if (ii !== undefined && ii >= 0) itemIndices.add(ii);
  }

  // Group items by row (similar y) and merge bounding boxes per row.
  const byRow = new Map<number, TextLayerItem[]>();
  for (const ii of itemIndices) {
    const it = items[ii]!;
    const rowKey = Math.round(it.y / 4) * 4;
    if (!byRow.has(rowKey)) byRow.set(rowKey, []);
    byRow.get(rowKey)!.push(it);
  }

  const rects: Rect[] = [];
  for (const [, rowItems] of byRow) {
    const minX = Math.min(...rowItems.map((it) => it.x));
    const minY = Math.min(...rowItems.map((it) => it.y));
    const maxX = Math.max(...rowItems.map((it) => it.x + it.width));
    const maxY = Math.max(...rowItems.map((it) => it.y + it.height));
    rects.push({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
  }

  return rects;
}
