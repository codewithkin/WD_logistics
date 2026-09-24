/**
 * A CSV builder for reports that are more than one table.
 *
 * The older per-report generators each hand-rolled their own header block and
 * totals row, which is why no two of them quote or title things quite the
 * same way. Anything that has several sections — profit and loss has three —
 * would have made that worse, so those go through here instead.
 *
 * The metadata block (report name, period, generated-at) is an option rather
 * than a fixture: a person opening the file in Excel wants it, and a script
 * parsing the file does not.
 */

export interface CsvSection {
  /** Printed above the section, blank line either side. Omit for a bare table. */
  title?: string;
  headers: string[];
  rows: CsvValue[][];
  /** A final bold-by-convention row; rendered like any other row. */
  total?: CsvValue[];
  /** Printed instead of the header row when there are no rows. */
  emptyMessage?: string;
}

export interface CsvReportOptions {
  /** Report title, e.g. "Profit & Loss". */
  title: string;
  /** Human-readable period line, e.g. "1 Jul 2026 - 30 Sep 2026". */
  period?: string;
  /** Company name for the metadata block. */
  company?: string;
  /**
   * Whether to print the metadata block above the data.
   *
   * On by default: these files are opened in Excel by people far more often
   * than they are parsed by scripts, and an untitled sheet of numbers is
   * worse than a redundant one. Pass false for a machine-readable export.
   */
  includeMetadata?: boolean;
  generatedAt?: Date;
}

/** A cell a report can put in a CSV. */
export type CsvValue = string | number | Date | null | undefined;

/** Quotes a single CSV cell, doubling any quotes inside it. */
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '""';
  if (value instanceof Date) return `"${value.toISOString().split("T")[0]}"`;
  return `"${String(value).replace(/"/g, '""')}"`;
}

const csvRow = (cells: CsvValue[]): string =>
  cells.map(csvCell).join(",");

/**
 * Renders a report as CSV.
 *
 * Sections are separated by a blank line so a spreadsheet shows them as
 * distinct blocks rather than one run-on table.
 */
export function buildReportCSV(
  options: CsvReportOptions,
  sections: CsvSection[],
): string {
  const lines: string[] = [];
  const { includeMetadata = true } = options;

  if (includeMetadata) {
    lines.push(csvRow([`${options.company ?? "WD Logistics"} - ${options.title}`]));
    if (options.period) lines.push(csvRow([`Period: ${options.period}`]));
    lines.push(
      csvRow([`Generated: ${(options.generatedAt ?? new Date()).toISOString()}`]),
    );
    lines.push("");
  }

  sections.forEach((section, index) => {
    if (index > 0) lines.push("");
    if (section.title) {
      lines.push(csvRow([section.title]));
    }

    if (section.rows.length === 0) {
      // A stated empty line, never a lone header over nothing — the reader
      // should be able to tell "no data" from "the export broke".
      lines.push(csvRow([section.emptyMessage ?? "No data for this period"]));
      return;
    }

    lines.push(csvRow(section.headers));
    for (const row of section.rows) lines.push(csvRow(row));
    if (section.total) lines.push(csvRow(section.total));
  });

  return lines.join("\n");
}
