import "server-only";

/**
 * The Word counterpart to `documents/kit.ts`.
 *
 * The PDFs were brought onto one brand; the .docx export was left behind
 * showing grey Calibri and hairline boxes, so the same customer report looked
 * like it came from a different company depending on which button was
 * pressed. This gives docx the same logo, the same green, the same shaded
 * table headers and the same footer.
 *
 * It intentionally mirrors the PDF kit's vocabulary — header, table, totals,
 * notes — so a change to one has an obvious counterpart in the other.
 */

import {
  AlignmentType,
  BorderStyle,
  Footer,
  Header,
  ImageRun,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertInchesToTwip,
  type ISectionOptions,
} from "docx";
import fs from "fs";
import path from "path";
import {
  BRAND,
  companyDetails,
  money,
  type OrganizationLike,
  type Rgb,
} from "@/lib/documents/brand";

/** docx wants "16A34A", jsPDF wants [22,163,74]; one palette, two encodings. */
const hex = (rgb: Rgb): string =>
  rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase();

export const WORD_COLORS = {
  green: hex(BRAND.green),
  greenLight: hex(BRAND.greenLight),
  ink: hex(BRAND.ink),
  muted: hex(BRAND.muted),
  border: hex(BRAND.border),
  zebra: hex(BRAND.zebra),
  danger: hex(BRAND.danger),
};

/** docx sizes are half-points, so 9.5pt body text is 19. */
const SIZE = {
  docTitle: 32,
  orgName: 26,
  heading: 22,
  body: 19,
  label: 18,
  small: 16,
  footer: 15,
};

let cachedLogoBytes: Buffer | null | undefined;

/**
 * The logo as raw bytes.
 *
 * `logoDataUrl()` returns a data URL for jsPDF; docx's ImageRun wants the
 * bytes themselves, so this reads the same file a second way rather than
 * parsing the base64 back apart.
 */
function logoBytes(): Buffer | null {
  if (cachedLogoBytes !== undefined) return cachedLogoBytes;
  try {
    cachedLogoBytes = fs.readFileSync(
      path.join(process.cwd(), "public", "logo.png"),
    );
  } catch {
    cachedLogoBytes = null;
  }
  return cachedLogoBytes;
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;

/**
 * The running header: logo and company name on the left, contact on the right.
 *
 * A missing logo file falls back to the name alone, exactly as the PDF header
 * does — a document that fails to render because an image is absent would be
 * a worse outcome than an unbranded one.
 */
export function brandHeader(organization?: OrganizationLike | null): Header {
  const company = companyDetails(organization);
  const logo = logoBytes();

  const left: Paragraph[] = [];

  if (logo) {
    left.push(
      new Paragraph({
        children: [
          new ImageRun({
            type: "png",
            data: logo,
            transformation: { width: 120, height: 40 },
          }),
        ],
        spacing: { after: 40 },
      }),
    );
  }

  left.push(
    new Paragraph({
      children: [
        new TextRun({
          text: company.name,
          bold: true,
          size: SIZE.orgName,
          color: WORD_COLORS.green,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: company.motto,
          size: SIZE.small,
          color: WORD_COLORS.muted,
          italics: true,
        }),
      ],
    }),
  );

  const contact = [
    ...company.addressLines,
    company.phone,
    company.email,
    company.website,
  ]
    .filter(Boolean)
    .map(
      (line) =>
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({
              text: String(line),
              size: SIZE.small,
              color: WORD_COLORS.muted,
            }),
          ],
        }),
    );

  return new Header({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: NO_BORDER,
          bottom: NO_BORDER,
          left: NO_BORDER,
          right: NO_BORDER,
          insideHorizontal: NO_BORDER,
          insideVertical: NO_BORDER,
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 55, type: WidthType.PERCENTAGE },
                margins: { top: 0, bottom: 0, left: 0, right: 0 },
                children: left,
              }),
              new TableCell({
                width: { size: 45, type: WidthType.PERCENTAGE },
                margins: { top: 0, bottom: 0, left: 0, right: 0 },
                children: contact.length > 0 ? contact : [new Paragraph("")],
              }),
            ],
          }),
        ],
      }),
      // The green rule under the header, matching the PDF's accent line.
      new Paragraph({
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 12, color: WORD_COLORS.green },
        },
        spacing: { before: 80, after: 200 },
        children: [],
      }),
    ],
  });
}

/** "WD Logistics · Page X of Y", the same footer line the PDFs carry. */
export function brandFooter(organization?: OrganizationLike | null): Footer {
  const company = companyDetails(organization);

  return new Footer({
    children: [
      new Paragraph({
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: WORD_COLORS.border },
        },
        spacing: { before: 100 },
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `${company.name} · ${company.phone} · ${company.email}`,
            size: SIZE.footer,
            color: WORD_COLORS.muted,
          }),
        ],
      }),
    ],
  });
}

/** The document's own title block, under the running header. */
export function titleBlock(title: string, subtitle?: string): Paragraph[] {
  const blocks = [
    new Paragraph({
      spacing: { after: subtitle ? 40 : 240 },
      children: [
        new TextRun({
          text: title.toUpperCase(),
          bold: true,
          size: SIZE.docTitle,
          color: WORD_COLORS.ink,
        }),
      ],
    }),
  ];

  if (subtitle) {
    blocks.push(
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: subtitle,
            size: SIZE.label,
            color: WORD_COLORS.muted,
          }),
        ],
      }),
    );
  }

  return blocks;
}

export function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: SIZE.heading,
        color: WORD_COLORS.green,
      }),
    ],
  });
}

function cellParagraph(
  value: string,
  options: { bold?: boolean; align?: "left" | "right"; color?: string },
): Paragraph {
  return new Paragraph({
    alignment:
      options.align === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT,
    children: [
      new TextRun({
        text: value,
        bold: options.bold,
        size: SIZE.body,
        color: options.color ?? WORD_COLORS.ink,
      }),
    ],
  });
}

export interface WordColumn {
  header: string;
  align?: "left" | "right";
  /** Percentage width; omit to share what is left evenly. */
  width?: number;
}

/**
 * The house table: green-tinted header row, zebra body, hairline rules.
 *
 * Returns a stated line instead of an empty grid when there are no rows, for
 * the same reason the PDF kit does — a bare header over nothing reads as a
 * broken export.
 */
export function brandTable(
  columns: WordColumn[],
  rows: string[][],
  options?: { total?: string[]; emptyMessage?: string },
): Table | Paragraph {
  if (rows.length === 0) {
    return new Paragraph({
      spacing: { after: 160 },
      children: [
        new TextRun({
          text: options?.emptyMessage ?? "No data for this period.",
          size: SIZE.body,
          italics: true,
          color: WORD_COLORS.muted,
        }),
      ],
    });
  }

  const hairline = {
    style: BorderStyle.SINGLE,
    size: 2,
    color: WORD_COLORS.border,
  } as const;

  const headerRow = new TableRow({
    tableHeader: true,
    children: columns.map(
      (column) =>
        new TableCell({
          width: column.width
            ? { size: column.width, type: WidthType.PERCENTAGE }
            : undefined,
          shading: {
            type: ShadingType.CLEAR,
            fill: WORD_COLORS.greenLight,
            color: "auto",
          },
          children: [
            cellParagraph(column.header, {
              bold: true,
              align: column.align,
              color: WORD_COLORS.ink,
            }),
          ],
        }),
    ),
  });

  const bodyRows = rows.map(
    (row, index) =>
      new TableRow({
        children: row.map(
          (value, cell) =>
            new TableCell({
              shading:
                index % 2 === 1
                  ? {
                      type: ShadingType.CLEAR,
                      fill: WORD_COLORS.zebra,
                      color: "auto",
                    }
                  : undefined,
              children: [
                cellParagraph(value, { align: columns[cell]?.align }),
              ],
            }),
        ),
      }),
  );

  if (options?.total) {
    bodyRows.push(
      new TableRow({
        children: options.total.map(
          (value, cell) =>
            new TableCell({
              shading: {
                type: ShadingType.CLEAR,
                fill: WORD_COLORS.greenLight,
                color: "auto",
              },
              children: [
                cellParagraph(value, {
                  bold: true,
                  align: columns[cell]?.align,
                }),
              ],
            }),
        ),
      }),
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: hairline,
      bottom: hairline,
      left: hairline,
      right: hairline,
      insideHorizontal: hairline,
      insideVertical: hairline,
    },
    rows: [headerRow, ...bodyRows],
  });
}

/** A labelled figure block, the docx answer to the PDF's KPI row. */
export function kpiTable(
  kpis: Array<{ label: string; value: string }>,
): Table | Paragraph {
  if (kpis.length === 0) return new Paragraph("");

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: NO_BORDER,
      bottom: NO_BORDER,
      left: NO_BORDER,
      right: NO_BORDER,
      insideHorizontal: NO_BORDER,
      insideVertical: NO_BORDER,
    },
    rows: [
      new TableRow({
        children: kpis.map(
          (kpi) =>
            new TableCell({
              shading: {
                type: ShadingType.CLEAR,
                fill: WORD_COLORS.zebra,
                color: "auto",
              },
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: kpi.label.toUpperCase(),
                      size: SIZE.small,
                      color: WORD_COLORS.muted,
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: kpi.value,
                      bold: true,
                      size: SIZE.heading,
                      color: WORD_COLORS.ink,
                    }),
                  ],
                }),
              ],
            }),
        ),
      }),
    ],
  });
}

/** A short prose block: notes, terms, the basis of a figure. */
export function notesBlock(heading: string, body: string): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 240, after: 60 },
      children: [
        new TextRun({
          text: heading.toUpperCase(),
          bold: true,
          size: SIZE.small,
          color: WORD_COLORS.muted,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: body, size: SIZE.body, color: WORD_COLORS.ink }),
      ],
    }),
  ];
}

/** Page setup shared by every Word document this app produces. */
export function sectionProperties(): ISectionOptions["properties"] {
  return {
    page: {
      margin: {
        top: convertInchesToTwip(0.6),
        right: convertInchesToTwip(0.6),
        bottom: convertInchesToTwip(0.6),
        left: convertInchesToTwip(0.6),
      },
    },
  };
}

export { money };
