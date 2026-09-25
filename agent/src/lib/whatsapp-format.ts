/**
 * Turns what a language model writes into what WhatsApp actually renders.
 *
 * Models are trained on Markdown, so they reach for `**bold**`, `###
 * Heading` and `[label](url)` by reflex. WhatsApp understands none of those:
 * it uses a single asterisk for bold, and everything it does not recognise
 * is shown to the reader verbatim. The assistant's instructions have said so
 * since it was written, and it still sent a customer:
 *
 *   You're welcome, **Kin**.
 *   I am sending the **Profit Per Unit Report** as a PDF now.
 *
 * — asterisks and all. Telling a model not to do something it does by
 * instinct is worth doing, but it is not a guarantee, and this is the last
 * thing that touches the text before it reaches a person. So it is also
 * fixed here, where it cannot be got wrong.
 *
 * ## What WhatsApp supports
 *
 *   *bold*            single asterisk
 *   _italic_
 *   ~strikethrough~
 *   ```monospace```   cannot be combined with the above
 *   `inline code`
 *   - item            bulleted list ("* item" also works)
 *   1. item           numbered list
 *   > quote           block quote, at the start of a line
 *
 * Headings, links, tables and underline do not exist. Bold, italic and
 * strikethrough can be nested; monospace cannot be combined with anything.
 */

/** Spans that must survive untouched: what is inside them is literal. */
const PROTECTED = /(```[\s\S]*?```|`[^`\n]*`)/g;

/**
 * Rewrites Markdown a model emitted into WhatsApp's own syntax.
 *
 * Conservative by design. Anything ambiguous is left exactly as written —
 * a stray asterisk in a figure is a much smaller problem than mangling a
 * number, and these are the numbers a business decides on.
 */
export function toWhatsAppMarkup(text: string): string {
  if (!text) return text;

  // Code spans are carved out first and put back at the end, so a `**` that
  // is genuinely part of quoted code is never rewritten.
  const held: string[] = [];
  let work = text.replace(PROTECTED, (match) => {
    held.push(match);
    return `\u0000${held.length - 1}\u0000`;
  });

  // ***both*** -> *_both_*. Done before the ** rule, which would otherwise
  // eat the outer pair and leave a lone asterisk behind.
  work = work.replace(/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, "*_$1_*");

  // **bold** -> *bold*. The single most common thing models get wrong here.
  work = work.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "*$1*");

  // __bold__ -> *bold*. Markdown reads this as bold; WhatsApp would read
  // the doubled underscores as an italic span wrapping stray underscores.
  work = work.replace(/__(?=\S)([\s\S]*?\S)__/g, "*$1*");

  // Headings have no equivalent. Bold is what a heading is for on a phone.
  work = work.replace(/^[ \t]*#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm, "*$1*");

  // [label](url) -> label (url). WhatsApp linkifies a bare URL on its own,
  // and the bracket form would otherwise be shown as punctuation.
  work = work.replace(
    /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g,
    (_m, label: string, url: string) => (label.trim() === url ? url : `${label} (${url})`),
  );

  // A table cannot be rendered on a phone and arrives as a wall of pipes.
  // The separator row is noise on its own; the rest reads better as text.
  work = work.replace(/^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(\|[ \t]*:?-{2,}:?[ \t]*)+\|?[ \t]*$/gm, "");
  work = work.replace(/^[ \t]*\|(.+)\|[ \t]*$/gm, (_m, row: string) =>
    row
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean)
      .join(" — "),
  );

  // Markdown's horizontal rule is just debris here.
  work = work.replace(/^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, "");

  // Collapse the blank lines the rules above can leave behind.
  work = work.replace(/\n{3,}/g, "\n\n");

  return work.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => held[Number(i)] ?? "").trim();
}
