import * as Y from "yjs";
import { bufferToUint8Array, uint8ArrayToBuffer } from "./encode-update.js";

export function encodeStateVector(doc: Y.Doc): Buffer {
  const sv = Y.encodeStateVector(doc);
  return uint8ArrayToBuffer(sv);
}

export function encodeStateAsUpdateWithVector(
  doc: Y.Doc,
  stateVector: Buffer | Uint8Array,
): Buffer {
  const sv = bufferToUint8Array(stateVector);
  const update = Y.encodeStateAsUpdate(doc, sv);
  return uint8ArrayToBuffer(update);
}
