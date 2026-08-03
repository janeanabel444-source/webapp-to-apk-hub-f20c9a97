/**
 * Minimal Android binary XML (AXML) reader.
 *
 * Enough to read AndroidManifest.xml out of an APK in the browser: element
 * names plus their attributes as primitive values. Pure, synchronous, no deps.
 */

export type AxmlAttr = {
  name: string;
  /** String value when the attribute is a string, otherwise a formatted value. */
  value: string | null;
  /** Raw 32-bit data as stored in the manifest. */
  raw: number;
  /** Resource type (0x01 = reference, 0x03 = string, 0x10 = int, 0x12 = bool). */
  type: number;
};

export type AxmlElement = {
  name: string;
  attrs: Record<string, AxmlAttr>;
};

const CHUNK_STRING_POOL = 0x0001;
const CHUNK_START_TAG = 0x0102;
const UTF8_FLAG = 1 << 8;

function readStringPool(buf: DataView, start: number): string[] {
  const chunkSize = buf.getUint32(start + 4, true);
  const stringCount = buf.getUint32(start + 8, true);
  const flags = buf.getUint32(start + 16, true);
  const stringsStart = buf.getUint32(start + 20, true);
  const isUtf8 = (flags & UTF8_FLAG) !== 0;
  const offsetsAt = start + 28;
  const dataAt = start + stringsStart;
  const out: string[] = [];
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);

  for (let i = 0; i < stringCount; i++) {
    const off = buf.getUint32(offsetsAt + i * 4, true);
    let p = dataAt + off;
    if (p >= start + chunkSize) {
      out.push("");
      continue;
    }
    if (isUtf8) {
      // Two length fields (chars, then bytes); each may be 1 or 2 bytes.
      let n = bytes[p++]!;
      if (n & 0x80) n = ((n & 0x7f) << 8) | bytes[p++]!;
      let byteLen = bytes[p++]!;
      if (byteLen & 0x80) byteLen = ((byteLen & 0x7f) << 8) | bytes[p++]!;
      out.push(new TextDecoder("utf-8").decode(bytes.subarray(p, p + byteLen)));
    } else {
      let n = buf.getUint16(p, true);
      p += 2;
      if (n & 0x8000) {
        n = ((n & 0x7fff) << 16) | buf.getUint16(p, true);
        p += 2;
      }
      let s = "";
      for (let c = 0; c < n; c++) s += String.fromCharCode(buf.getUint16(p + c * 2, true));
      out.push(s);
    }
  }
  return out;
}

function formatValue(type: number, data: number, strings: string[]): string | null {
  switch (type) {
    case 0x03:
      return strings[data] ?? null;
    case 0x10:
      return String(data);
    case 0x11:
      return `0x${(data >>> 0).toString(16)}`;
    case 0x12:
      return data === 0 ? "false" : "true";
    case 0x01:
    case 0x02:
      return `@0x${(data >>> 0).toString(16)}`;
    case 0x04:
      return String(new Float32Array(new Uint32Array([data >>> 0]).buffer)[0]);
    default:
      return null;
  }
}

/** Parse an AXML buffer into a flat list of elements in document order. */
export function parseAxml(input: ArrayBuffer | Uint8Array): AxmlElement[] {
  const u8 = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (view.byteLength < 16) throw new Error("Manifest is too small to be valid.");

  const fileSize = Math.min(view.getUint32(4, true) || view.byteLength, view.byteLength);
  let strings: string[] = [];
  const elements: AxmlElement[] = [];

  let pos = 8;
  let guard = 0;
  while (pos + 8 <= fileSize && guard++ < 200_000) {
    const type = view.getUint16(pos, true);
    const size = view.getUint32(pos + 4, true);
    if (size <= 0 || pos + size > fileSize) break;

    if (type === CHUNK_STRING_POOL) {
      strings = readStringPool(view, pos);
    } else if (type === CHUNK_START_TAG) {
      const nameIdx = view.getUint32(pos + 20, true);
      const attrStart = view.getUint16(pos + 24, true);
      const attrSize = view.getUint16(pos + 26, true);
      const attrCount = view.getUint16(pos + 28, true);
      const el: AxmlElement = { name: strings[nameIdx] ?? "", attrs: {} };
      for (let i = 0; i < attrCount; i++) {
        const a = pos + attrStart + i * attrSize;
        if (a + 20 > pos + size) break;
        const aName = strings[view.getUint32(a + 4, true)] ?? "";
        const rawIdx = view.getUint32(a + 8, true);
        const valType = view.getUint8(a + 15);
        const valData = view.getUint32(a + 16, true);
        const asString =
          rawIdx !== 0xffffffff ? (strings[rawIdx] ?? null) : formatValue(valType, valData, strings);
        if (aName) el.attrs[aName] = { name: aName, value: asString, raw: valData, type: valType };
      }
      elements.push(el);
    }
    pos += size;
  }

  if (!elements.length) throw new Error("No readable elements in AndroidManifest.xml.");
  return elements;
}
