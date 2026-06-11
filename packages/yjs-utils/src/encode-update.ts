import * as Y from "yjs";

export function bufferToUint8Array(
  buffer: Buffer | ArrayBuffer | Uint8Array,
): Uint8Array {
  if (buffer instanceof Uint8Array) return buffer;
  return new Uint8Array(buffer);
}

export function uint8ArrayToBuffer(array: Uint8Array): Buffer {
  return Buffer.from(array.buffer, array.byteOffset, array.byteLength);
}

export function encodeStateAsUpdate(doc: Y.Doc): Buffer {
  const update = Y.encodeStateAsUpdate(doc);
  return uint8ArrayToBuffer(update);
}

export function applyUpdateToDoc(
  doc: Y.Doc,
  update: Buffer | Uint8Array,
  origin?: unknown,
): void {
  const uint8 = bufferToUint8Array(update);
  Y.applyUpdate(doc, uint8, origin);
}
