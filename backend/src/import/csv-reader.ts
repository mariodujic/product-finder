import { parse } from 'csv-parse/sync';
import { REQUIRED_COLUMNS, RawRow, SourceRow } from './import.types';

export class CsvStructureError extends Error {}

/**
 * Parses the PIM export. Uses a real CSV parser: descriptions contain quoted
 * commas and escaped quotes, so naive splitting would corrupt rows.
 * Fails fast on structural problems (missing columns, ragged rows) because
 * those mean the export is broken, not that one product is bad.
 */
export function readCsv(content: string): SourceRow[] {
  let records: string[][];
  try {
    records = parse(content, {
      bom: true,
      skip_empty_lines: true,
      relax_column_count: false,
    });
  } catch (err) {
    throw new CsvStructureError(`Unreadable CSV: ${(err as Error).message}`);
  }
  if (records.length === 0) throw new CsvStructureError('CSV is empty');

  const header = records[0].map((h) => h.trim().toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    throw new CsvStructureError(
      `CSV is missing required column(s): ${missing.join(', ')}`,
    );
  }

  return records.slice(1).map((cells, i) => {
    const values = {} as RawRow;
    for (const column of REQUIRED_COLUMNS) {
      values[column] = cells[header.indexOf(column)] ?? '';
    }
    // Header is line 1. The PIM export has one physical line per record.
    return { line: i + 2, values };
  });
}
