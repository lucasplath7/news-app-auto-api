export function extractBalancedJsonObjectsFromArrayText(arrayText: string): string[] {
  // Expects text that starts at the beginning of an array (right after `[` in `"usNews":[ ... ]`)
  // Returns complete top-level `{...}` object substrings found so far.
  const results: string[] = [];

  let i = 0;
  // skip leading whitespace and commas
  while (i < arrayText.length) {
    while (i < arrayText.length && /[\s,]/.test(arrayText[i]!)) i++;
    if (i >= arrayText.length) break;

    if (arrayText[i] !== "{") {
      // Not at an object boundary yet
      break;
    }

    const start = i;
    let depth = 0;
    let inString = false;
    let escaping = false;

    for (; i < arrayText.length; i++) {
      const ch = arrayText[i]!;

      if (inString) {
        if (escaping) {
          escaping = false;
          continue;
        }
        if (ch === "\\") {
          escaping = true;
          continue;
        }
        if (ch === '"') inString = false;
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === "{") depth++;
      if (ch === "}") depth--;

      if (depth === 0) {
        // Object complete (inclusive)
        const objText = arrayText.slice(start, i + 1);
        results.push(objText);
        i++; // move past `}`
        break;
      }
    }

    // If we exited loop without closing depth to 0, object is incomplete
    if (results.length === 0 || results[results.length - 1] !== arrayText.slice(start, i)) {
      // do nothing; wait for more data
    }
  }

  return results;
}

export function findNewsArrayStartOffset(buffer: string): number | null {
  // Find `"usNews":` then the first `[` after it
  const keyIdx = buffer.indexOf('"usNews"');
  if (keyIdx === -1) return null;

  const colonIdx = buffer.indexOf(":", keyIdx);
  if (colonIdx === -1) return null;

  const bracketIdx = buffer.indexOf("[", colonIdx);
  if (bracketIdx === -1) return null;

  return bracketIdx + 1; // position right after `[`
}