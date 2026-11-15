/**
 * A minimal reader for SQLite database files: enough to list the rows of one
 * ordinary table. It exists so a backup can be imported on any platform
 * without shipping a database engine.
 *
 * Limits: rows that spill onto overflow pages are not supported (an error is
 * raised), and only UTF-8 databases are read.
 */
type Value = number | string | null;
export type Row = Record<string, Value>;

class Reader {
  readonly view: DataView;
  constructor(readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  /** A variable-length integer; returns [value, bytes read]. */
  varint(at: number): [number, number] {
    let value = 0;
    for (let i = 0; i < 9; i += 1) {
      const byte = this.bytes[at + i];
      if (i === 8) return [value * 256 + byte, 9];
      value = value * 128 + (byte & 0x7f);
      if (byte < 0x80) return [value, i + 1];
    }
    return [value, 9];
  }
}

function utf8(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i++];
    let code: number;
    if (b < 0x80) code = b;
    else if (b < 0xe0) code = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f);
    else if (b < 0xf0) code = ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    else code = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    out += String.fromCodePoint(code);
  }
  return out;
}

/** Signed big-endian integer of 1–8 bytes. Values beyond 2^53 lose precision, which no date or count reaches. */
function signedInt(r: Reader, at: number, size: number): number {
  let value = r.bytes[at] >= 0x80 ? r.bytes[at] - 256 : r.bytes[at];
  for (let i = 1; i < size; i += 1) value = value * 256 + r.bytes[at + i];
  return value;
}

function decodeRecord(r: Reader, at: number, rowId: number): Value[] {
  const [headerSize, headerBytes] = r.varint(at);
  const types: number[] = [];
  for (let p = at + headerBytes; p < at + headerSize; ) {
    const [type, n] = r.varint(p);
    types.push(type);
    p += n;
  }
  let p = at + headerSize;
  return types.map((type) => {
    if (type === 0) return null;
    if (type >= 1 && type <= 6) {
      const size = [0, 1, 2, 3, 4, 6, 8][type];
      const value = signedInt(r, p, size);
      p += size;
      return value;
    }
    if (type === 7) {
      const value = r.view.getFloat64(p);
      p += 8;
      return value;
    }
    if (type === 8) return 0;
    if (type === 9) return 1;
    const size = Math.floor((type - (type % 2 === 0 ? 12 : 13)) / 2);
    const slice = r.bytes.subarray(p, p + size);
    p += size;
    // Even types are raw bytes; they are of no use here.
    return type % 2 === 0 ? null : utf8(slice);
  }).map((value, i) => (value === null && i === 0 ? rowId : value));
}

/** Every row of a table b-tree, as arrays of column values. An INTEGER PRIMARY KEY first column carries the row id. */
function readTable(r: Reader, pageSize: number, usable: number, rootPage: number): Value[][] {
  const rows: Value[][] = [];
  const maxLocal = usable - 35;
  const visit = (pageNumber: number, depth: number) => {
    if (depth > 20) throw new Error('Database file is damaged');
    const pageStart = (pageNumber - 1) * pageSize;
    const header = pageNumber === 1 ? pageStart + 100 : pageStart;
    const kind = r.bytes[header];
    const cells = r.view.getUint16(header + 3);
    const pointers = header + (kind === 0x05 ? 12 : 8);
    for (let i = 0; i < cells; i += 1) {
      const cell = pageStart + r.view.getUint16(pointers + i * 2);
      if (kind === 0x05) {
        visit(r.view.getUint32(cell), depth + 1);
      } else if (kind === 0x0d) {
        const [payload, n1] = r.varint(cell);
        const [rowId, n2] = r.varint(cell + n1);
        if (payload > maxLocal) throw new Error('This backup holds rows too large for the importer');
        rows.push(decodeRecord(r, cell + n1 + n2, rowId));
      } else {
        throw new Error('Database file is damaged');
      }
    }
    if (kind === 0x05) visit(r.view.getUint32(header + 8), depth + 1);
  };
  visit(rootPage, 0);
  return rows;
}

/** Column names from a CREATE TABLE statement. */
function columnNames(sql: string): string[] {
  const inside = sql.slice(sql.indexOf('(') + 1, sql.lastIndexOf(')'));
  return inside.split(',').map((part) => part.trim().split(/\s+/)[0].replace(/["'`[\]]/g, ''));
}

/** The rows of a named table, keyed by column name. Throws when the file is not a SQLite database or lacks the table. */
export function readSqliteTable(file: Uint8Array, table: string): Row[] {
  if (utf8(file.subarray(0, 15)) !== 'SQLite format 3') throw new Error('Not a SQLite database');
  const r = new Reader(file);
  const declared = r.view.getUint16(16);
  const pageSize = declared === 1 ? 65536 : declared;
  const usable = pageSize - file[20];
  // The schema table: type, name, tbl_name, rootpage, sql.
  const entry = readTable(r, pageSize, usable, 1).find((row) => row[0] === 'table' && row[1] === table);
  if (!entry) throw new Error(`Table ${table} not found`);
  const names = columnNames(String(entry[4]));
  return readTable(r, pageSize, usable, Number(entry[3])).map((values) => Object.fromEntries(names.map((name, i) => [name, values[i] ?? null])));
}
