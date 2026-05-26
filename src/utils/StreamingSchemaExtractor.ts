import type { ZodType } from 'zod';

/**
 * Accumulates streamed JSON text and extracts validated objects from an array
 * property as they become complete.
 *
 * @example
 * ```ts
 * const extractor = new StreamingSchemaExtractor(NewsItemSchema, 'usNews');
 *
 * for await (const event of stream) {
 *   if (event.type === 'response.output_text.delta') {
 *     extractor.append(event.delta);
 *     let item;
 *     while ((item = extractor.next()) !== null) {
 *       // `item` is fully validated against the schema
 *       res.write(`event: item\ndata: ${JSON.stringify(item)}\n\n`);
 *     }
 *   }
 * }
 * ```
 */
export class StreamingSchemaExtractor<T> {
  private schema: ZodType<T>;
  private propertyName: string;
  private buffer = '';
  private arrayStartOffset: number | null = null;
  private emittedCount = 0;
  /** Cached parsed objects that have been extracted but not yet consumed via next(). */
  private pending: T[] = [];

  constructor(schema: ZodType<T>, propertyName: string) {
    this.schema = schema;
    this.propertyName = propertyName;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Append a new text chunk (delta) to the internal buffer and extract any newly complete items. */
  append(text: string): void {
    this.buffer += text;

    // Try to locate the array start if we haven't yet
    if (this.arrayStartOffset === null) {
      this.arrayStartOffset = this.findArrayStartOffset();
      if (this.arrayStartOffset === null) return; // not enough data yet
    }

    const arrayText = this.buffer.slice(this.arrayStartOffset);
    const objectTexts = extractBalancedJsonObjects(arrayText);

    // Only process objects we haven't emitted yet
    for (let i = this.emittedCount; i < objectTexts.length; i++) {
      const raw = objectTexts[i]!;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Incomplete or malformed JSON – stop here and wait for more tokens
        break;
      }

      const result = this.schema.safeParse(parsed);
      if (!result.success) {
        // Object doesn't validate yet – stop and wait for more data
        break;
      }

      this.pending.push(result.data);
      this.emittedCount++;
    }
  }

  /**
   * Return the next validated item, or `null` if none is available yet.
   *
   * ```ts
   * let item;
   * while ((item = extractor.next()) !== null) { … }
   * ```
   */
  next(): T | null {
    return this.pending.shift() ?? null;
  }

  /** Drain all currently available validated items at once. */
  drain(): T[] {
    const items = this.pending;
    this.pending = [];
    return items;
  }

  /** How many items have been fully extracted so far. */
  get extractedCount(): number {
    return this.emittedCount;
  }

  /** Iterable interface – lets you do `for (const item of extractor)`. */
  *[Symbol.iterator](): Generator<T> {
    let item: T | null;
    while ((item = this.next()) !== null) {
      yield item;
    }
  }

  /** Reset the extractor so it can be reused with a fresh stream. */
  reset(): void {
    this.buffer = '';
    this.arrayStartOffset = null;
    this.emittedCount = 0;
    this.pending = [];
  }

  // ── Internals ───────────────────────────────────────────────────────────

  /**
   * Locate `"<propertyName>"` followed by `:` then `[` in the buffer,
   * returning the index immediately after `[`.
   */
  private findArrayStartOffset(): number | null {
    const keyIdx = this.buffer.indexOf(`"${this.propertyName}"`);
    if (keyIdx === -1) return null;

    const colonIdx = this.buffer.indexOf(':', keyIdx);
    if (colonIdx === -1) return null;

    const bracketIdx = this.buffer.indexOf('[', colonIdx);
    if (bracketIdx === -1) return null;

    return bracketIdx + 1;
  }
}

// ── Standalone helpers ────────────────────────────────────────────────────

/**
 * Given text that starts right after the opening `[` of a JSON array,
 * extract all complete top-level `{ … }` substrings found so far.
 */
function extractBalancedJsonObjects(arrayText: string): string[] {
  const results: string[] = [];
  let i = 0;

  while (i < arrayText.length) {
    // skip whitespace and commas between objects
    while (i < arrayText.length && /[\s,]/.test(arrayText[i]!)) i++;
    if (i >= arrayText.length || arrayText[i] !== '{') break;

    const start = i;
    let depth = 0;
    let inString = false;
    let escaping = false;
    let complete = false;

    for (; i < arrayText.length; i++) {
      const ch = arrayText[i]!;

      if (inString) {
        if (escaping) { escaping = false; continue; }
        if (ch === '\\') { escaping = true; continue; }
        if (ch === '"') inString = false;
        continue;
      }

      if (ch === '"') { inString = true; continue; }
      if (ch === '{') depth++;
      if (ch === '}') depth--;

      if (depth === 0) {
        results.push(arrayText.slice(start, i + 1));
        i++;
        complete = true;
        break;
      }
    }

    // Object still incomplete – stop and wait for more data
    if (!complete) break;
  }

  return results;
}

