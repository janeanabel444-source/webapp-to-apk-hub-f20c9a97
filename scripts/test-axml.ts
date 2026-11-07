import assert from "node:assert/strict";
import { parseAxml } from "../src/lib/axml";
import { findForbiddenPermissions } from "../src/lib/apk-security.server";

function utf8Length(value: number) {
  if (value < 0x80) return [value];
  if (value < 0x800) return [0x80 | (value >> 6), 0x80 | (value & 0x3f)];
  return [0xe0 | (value >> 12), 0x80 | ((value >> 6) & 0x3f), 0x80 | (value & 0x3f)];
}

function length8(value: number) {
  return value < 0x80 ? [value] : [0x80 | (value >> 8), value & 0xff];
}

function makeStringPool(strings: string[]) {
  const encoded = strings.map((text) => {
    const bytes = [...text].flatMap((char) => utf8Length(char.codePointAt(0) ?? 0));
    return [...length8(text.length), ...length8(bytes.length), ...bytes, 0];
  });
  const offsets: number[] = [];
  let cursor = 0;
  for (const item of encoded) { offsets.push(cursor); cursor += item.length; }
  const headerSize = 28;
  const stringsStart = headerSize + offsets.length * 4;
  const size = stringsStart + cursor;
  const chunk = new Uint8Array(size);
  const view = new DataView(chunk.buffer);
  view.setUint16(0, 1, true);
  view.setUint16(2, headerSize, true);
  view.setUint32(4, size, true);
  view.setUint32(8, strings.length, true);
  view.setUint32(16, 0x100, true);
  view.setUint32(20, stringsStart, true);
  offsets.forEach((offset, i) => view.setUint32(headerSize + i * 4, offset, true));
  let p = stringsStart;
  for (const item of encoded) { chunk.set(item, p); p += item.length; }
  return chunk;
}

function startTag(nameIndex: number, attrs: Array<{ nameIndex: number; valueIndex?: number; intValue?: number }>) {
  const size = 36 + attrs.length * 20;
  const chunk = new Uint8Array(size);
  const view = new DataView(chunk.buffer);
  view.setUint16(0, 0x102, true);
  view.setUint16(2, 16, true);
  view.setUint32(4, size, true);
  view.setUint32(20, nameIndex, true);
  view.setUint16(24, 20, true);
  view.setUint16(26, 20, true);
  view.setUint16(28, attrs.length, true);
  attrs.forEach((attr, i) => {
    const p = 36 + i * 20;
    view.setUint32(p + 4, attr.nameIndex, true);
    view.setUint32(p + 8, attr.valueIndex ?? 0xffffffff, true);
    view.setUint16(p + 12, 8, true);
    view.setUint8(p + 15, attr.intValue === undefined ? 3 : 0x10);
    view.setUint32(p + 16, attr.intValue ?? attr.valueIndex ?? 0, true);
  });
  return chunk;
}

const strings = [
  "manifest", "package", "versionCode", "versionName", "com.example.parser", "2.4.1",
  "uses-permission", "name", "android.permission.CAMERA",
];
const chunks = [
  makeStringPool(strings),
  startTag(0, [
    { nameIndex: 1, valueIndex: 4 },
    { nameIndex: 2, intValue: 2401 },
    { nameIndex: 3, valueIndex: 5 },
  ]),
  startTag(6, [{ nameIndex: 7, valueIndex: 8 }]),
];
const fileSize = 8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
const manifest = new Uint8Array(fileSize);
const rootView = new DataView(manifest.buffer);
rootView.setUint16(0, 3, true);
rootView.setUint16(2, 8, true);
rootView.setUint32(4, fileSize, true);
let offset = 8;
for (const chunk of chunks) { manifest.set(chunk, offset); offset += chunk.length; }

const elements = parseAxml(manifest);
const root = elements.find((element) => element.name === "manifest");
const permission = elements.find((element) => element.name === "uses-permission");
assert.equal(root?.attrs.package?.value, "com.example.parser");
assert.equal(root?.attrs.versionName?.value, "2.4.1");
assert.equal(root?.attrs.versionCode?.raw, 2401);
assert.equal(permission?.attrs.name?.value, "android.permission.CAMERA");
assert.deepEqual(
  findForbiddenPermissions(["android.permission.REQUEST_INSTALL_PACKAGES"], "com.niza.marketplace"),
  [],
);
assert.deepEqual(
  findForbiddenPermissions(["android.permission.REQUEST_INSTALL_PACKAGES"], "com.example.other"),
  ["android.permission.REQUEST_INSTALL_PACKAGES"],
);
console.log("AXML parsing and Niza Store permission-gate checks passed.");