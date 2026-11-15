/**
 * Reading a backup file (".pc") made by the "My Calendar" period tracker.
 *
 * The file is a Java object stream whose block-data records, joined together,
 * hold a zip archive; inside it, `cloud.db` is a SQLite database with a
 * `Period` table: one row per period, with its start date and length.
 */
import { unzipSync } from 'fflate';

import { parseIso, toIso } from '../dates';
import { readSqliteTable } from './sqlite';

export type ImportedPeriod = {
  /** First day, 'YYYY-MM-DD'. */
  start: string;
  /** Number of days of bleeding. */
  days: number;
};

/** The bytes carried by a Java object stream's block-data records. */
function unwrapJavaStream(file: Uint8Array): Uint8Array {
  if (!(file[0] === 0xac && file[1] === 0xed && file[2] === 0x00 && file[3] === 0x05)) throw new Error('Not a period tracker backup');
  const parts: Uint8Array[] = [];
  let total = 0;
  for (let i = 4; i < file.length; ) {
    let length: number;
    if (file[i] === 0x7a) {
      // Long block: four-byte length.
      length = ((file[i + 1] << 24) | (file[i + 2] << 16) | (file[i + 3] << 8) | file[i + 4]) >>> 0;
      i += 5;
    } else if (file[i] === 0x77) {
      // Short block: one-byte length.
      length = file[i + 1];
      i += 2;
    } else {
      break;
    }
    parts.push(file.subarray(i, i + length));
    total += length;
    i += length;
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Periods found in a backup file, oldest first. Throws with a plain message when the file is not such a backup. */
export function parsePeriodBackup(file: Uint8Array): ImportedPeriod[] {
  const stream = unwrapJavaStream(file);
  // The zip starts after a short prefix of the app's own.
  let zipStart = -1;
  for (let i = 0; i + 3 < Math.min(stream.length, 256); i += 1) {
    if (stream[i] === 0x50 && stream[i + 1] === 0x4b && stream[i + 2] === 0x03 && stream[i + 3] === 0x04) {
      zipStart = i;
      break;
    }
  }
  if (zipStart < 0) throw new Error('Not a period tracker backup');
  const database = unzipSync(stream.subarray(zipStart), { filter: (entry) => entry.name === 'cloud.db' })['cloud.db'];
  if (!database) throw new Error('The backup holds no data');

  const seen = new Set<string>();
  const periods: ImportedPeriod[] = [];
  for (const row of readSqliteTable(database, 'Period')) {
    const date = Number(row.date);
    const iso = `${Math.floor(date / 10000)}-${String(Math.floor(date / 100) % 100).padStart(2, '0')}-${String(date % 100).padStart(2, '0')}`;
    const day = parseIso(iso);
    if (day === null || seen.has(iso)) continue;
    seen.add(iso);
    // The tracker stores the number of days after the first; a negative value marks a length it filled in itself.
    const days = Math.min(15, Math.max(1, Math.abs(Number(row.period) || 0) + 1));
    periods.push({ start: toIso(day), days });
  }
  return periods.sort((a, b) => (a.start < b.start ? -1 : 1));
}
