/**
 * Utility functions for text formatting and normalization.
 */

/**
 * Normalizes an advertisement description to improve readability and presentation.
 * It removes duplicate spaces, limits excessive line breaks, restores missing spacing between glued sentences,
 * and formats simple lists into bullets consistently.
 *
 * @param text The raw description text
 * @returns The normalized, clean, and styled description text
 */
export function normalizeDescription(text: string | null | undefined): string {
  if (!text) return '';

  // 1. Split text into individual lines to clean and format line-by-line
  const lines = text.split(/\r?\n/);
  const processedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Remove duplicates of horizontal whitespace (spaces & tabs) inside the line, and trim
    line = line.replace(/[ \t]+/g, ' ').trim();

    // If it's an empty line, preserve it as a paragraph delimiter
    if (line === '') {
      processedLines.push('');
      continue;
    }

    // 2. Fix glued sentences: Punctuation directly followed by a Capital Letter without spaces
    // Examples: "Excelente estado.Como novo." -> "Excelente estado. Como novo."
    // Supports typical portuguese/english capital letters (A-Z and accented characters like À-Ú)
    line = line.replace(/(\w+[\.!\?,;:]{1,3})([A-ZÀ-Ú])/g, '$1 $2');

    // 3. Normalize bullet lists and topic lines nicely
    // If line starts with standard list patterns (- , * , + , •) or directly glued (-item, *item)
    const listPattern = /^([-*•+]|[0-9]+\.|\w\))\s*(.*)$/;
    const listMatch = line.match(listPattern);

    if (listMatch) {
      const marker = listMatch[1];
      const content = listMatch[2].trim();

      if (content) {
        // If it's a numeric list (e.g. "1.", "2.") or letter marker (e.g. "a)"), keep it
        if (/^[0-9]+\.$/.test(marker)) {
          line = `${marker} ${content}`;
        } else if (/^\w\)$/.test(marker)) {
          line = `${marker} ${content}`;
        } else {
          // Normalize normal dashes/asterisks into uniform dots
          line = `• ${content}`;
        }
      }
    }

    processedLines.push(line);
  }

  // 4. Combine lines back together
  let result = processedLines.join('\n');

  // 5. Correct excessive blank lines (more than 1 blank line / 2 line breaks)
  result = result.replace(/\n{3,}/g, '\n\n');

  // Trim leading/trailing blank lines
  return result.trim();
}
