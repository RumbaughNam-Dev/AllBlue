import type { EssayBlock, EssaySpan } from '@/services/api';

// 에세이 서식 (5장, 12장 3번): 굵게 · 기울임 · 밑줄, 크기 3단계, 글자 색 8개. 서체 선택 없음.
// 서버 community-rules.ts의 ESSAY_COLORS · ESSAY_SIZES와 같음
export const ESSAY_COLORS = ['#FFFFFF', '#B8D4F0', '#00B4D8', '#2DC48D', '#FFD166', '#FF8C42', '#FF6B8A', '#B794F4'];
export const ESSAY_FONT_SIZE = { S: 14, M: 16, L: 20 } as const;
export const ESSAY_LINE_HEIGHT = { S: 22, M: 26, L: 30 } as const;
export type SpanStyle = Omit<EssaySpan, 't'>;
export type StylePatch = { b?: boolean; i?: boolean; u?: boolean; s?: 'S' | 'M' | 'L'; c?: string };

const clean = (style: SpanStyle | StylePatch): SpanStyle => ({
  ...(style.b ? { b: true } : {}),
  ...(style.i ? { i: true } : {}),
  ...(style.u ? { u: true } : {}),
  ...(style.s && style.s !== 'M' ? { s: style.s } : {}),
  ...(style.c && style.c.toUpperCase() !== ESSAY_COLORS[0] ? { c: style.c.toUpperCase() } : {}),
});

export const sameStyle = (a: SpanStyle, b: SpanStyle) =>
  !!a.b === !!b.b && !!a.i === !!b.i && !!a.u === !!b.u && (a.s ?? 'M') === (b.s ?? 'M') && (a.c ?? '') === (b.c ?? '');

export const spansText = (spans: EssaySpan[]) => spans.map(s => s.t).join('');

// 빈 조각을 버리고 같은 서식끼리 붙임
export function normalize(spans: EssaySpan[]): EssaySpan[] {
  const result: EssaySpan[] = [];
  for (const span of spans) {
    if (!span.t) continue;
    const style = clean(span);
    const last = result[result.length - 1];
    if (last && sameStyle(last, style)) last.t += span.t;
    else result.push({ t: span.t, ...style });
  }
  return result;
}

// [left, right] at a character position
export function splitSpans(spans: EssaySpan[], pos: number): [EssaySpan[], EssaySpan[]] {
  const left: EssaySpan[] = [], right: EssaySpan[] = [];
  let offset = 0;
  for (const span of spans) {
    const end = offset + span.t.length;
    if (end <= pos) left.push({ ...span });
    else if (offset >= pos) right.push({ ...span });
    else {
      left.push({ ...span, t: span.t.slice(0, pos - offset) });
      right.push({ ...span, t: span.t.slice(pos - offset) });
    }
    offset = end;
  }
  return [normalize(left), normalize(right)];
}

// The style a character typed at `pos` takes: the character before it (or after, at the start).
export function styleAt(spans: EssaySpan[], pos: number): SpanStyle {
  let offset = 0;
  for (const span of spans) {
    const end = offset + span.t.length;
    if (pos > offset && pos <= end) return clean(span);
    offset = end;
  }
  return spans[0] ? clean(spans[0]) : {};
}

// Replace characters [start, end) with `text` in `style`.
export function spliceSpans(spans: EssaySpan[], start: number, end: number, text: string, style: SpanStyle): EssaySpan[] {
  const [left] = splitSpans(spans, start);
  const [, right] = splitSpans(spans, end);
  return normalize([...left, { t: text, ...style }, ...right]);
}

// Apply a style change to [start, end). Booleans set or clear; size and color replace.
export function applyStyle(spans: EssaySpan[], start: number, end: number, patch: StylePatch): EssaySpan[] {
  const [left, rest] = splitSpans(spans, start);
  const [middle, right] = splitSpans(rest, end - start);
  return normalize([...left, ...middle.map(span => ({ t: span.t, ...clean({ ...span, ...patch }) })), ...right]);
}

// Whether every character in [start, end) already has the flag (then the toolbar button clears it).
export function allHave(spans: EssaySpan[], start: number, end: number, flag: 'b' | 'i' | 'u') {
  const [, rest] = splitSpans(spans, start);
  const [middle] = splitSpans(rest, end - start);
  return middle.length > 0 && middle.every(span => !!span[flag]);
}

// What changed between two versions of a paragraph's plain text: characters [start, end) of the old
// text became `inserted`. Typing, deleting, pasting and autocorrect all come through here.
export function textChange(before: string, after: string) {
  let start = 0;
  const max = Math.min(before.length, after.length);
  while (start < max && before[start] === after[start]) start++;
  let tail = 0;
  while (tail < max - start && before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail++;
  return { start, end: before.length - tail, inserted: after.slice(start, after.length - tail) };
}

// ── 편집기 블록: 문단(글) · 사진. 사진은 문단과 문단 사이에만 들어감 ──
export type EditorBlock =
  | { key: string; type: 'p'; spans: EssaySpan[] }
  | { key: string; type: 'img'; url: string; w?: number; h?: number };

let nextKey = 0;
export const blockKey = () => `b${++nextKey}`;

export function fromBody(body: EssayBlock[] | null | undefined): EditorBlock[] {
  const blocks: EditorBlock[] = [];
  for (const block of body ?? []) {
    if (block.type === 'img') {
      if (blocks[blocks.length - 1]?.type !== 'p') blocks.push({ key: blockKey(), type: 'p', spans: [] });
      blocks.push({ key: blockKey(), ...block });
    } else {
      const last = blocks[blocks.length - 1];
      // 이어진 문단은 줄바꿈으로 하나로 (편집기에서는 사진 사이마다 글 칸이 하나)
      if (last?.type === 'p') last.spans = normalize([...last.spans, ...(last.spans.length ? [{ t: '\n' }] : []), ...block.spans]);
      else blocks.push({ key: blockKey(), type: 'p', spans: normalize(block.spans) });
    }
  }
  if (blocks[blocks.length - 1]?.type !== 'p') blocks.push({ key: blockKey(), type: 'p', spans: [] });
  return blocks;
}

export function toBody(blocks: EditorBlock[]): EssayBlock[] {
  return blocks
    .map(({ key, ...block }) => block as EssayBlock)
    .filter(block => block.type === 'img' || block.spans.length > 0);
}

// 사진을 넣으면 커서 자리에서 문단을 나눠 그 사이에 넣고, 뒤쪽 문단에 커서를 둠
export function insertImage(blocks: EditorBlock[], paragraphKey: string, caret: number, image: { url: string; w?: number; h?: number }) {
  const index = blocks.findIndex(b => b.key === paragraphKey);
  const target = blocks[index];
  if (!target || target.type !== 'p') return { blocks: [...blocks, { key: blockKey(), type: 'img' as const, ...image }, { key: blockKey(), type: 'p' as const, spans: [] }], focusKey: null };
  const [left, right] = splitSpans(target.spans, caret);
  // 줄 끝 · 줄 처음의 줄바꿈은 사진이 대신함
  const trimEnd = left.length && left[left.length - 1].t.endsWith('\n') ? spliceSpans(left, spansText(left).length - 1, spansText(left).length, '', {}) : left;
  const trimStart = right.length && right[0].t.startsWith('\n') ? spliceSpans(right, 0, 1, '', {}) : right;
  const after = { key: blockKey(), type: 'p' as const, spans: trimStart };
  return {
    blocks: [...blocks.slice(0, index), { ...target, spans: trimEnd }, { key: blockKey(), type: 'img' as const, ...image }, after, ...blocks.slice(index + 1)],
    focusKey: after.key,
  };
}

// 사진을 빼면 앞뒤 문단을 줄바꿈으로 이어 붙임
export function removeImage(blocks: EditorBlock[], imageKey: string) {
  const index = blocks.findIndex(b => b.key === imageKey);
  const before = blocks[index - 1], after = blocks[index + 1];
  if (before?.type === 'p' && after?.type === 'p') {
    const joined = before.spans.length && after.spans.length ? [...before.spans, { t: '\n' }, ...after.spans] : [...before.spans, ...after.spans];
    return [...blocks.slice(0, index - 1), { ...before, spans: normalize(joined) }, ...blocks.slice(index + 2)];
  }
  return blocks.filter(b => b.key !== imageKey);
}

export function essayHasContent(blocks: EditorBlock[]) {
  return blocks.some(b => b.type === 'img' || spansText(b.spans).trim().length > 0);
}
