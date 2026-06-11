export interface YjsSyncStep1Payload {
  docId: string;
  stateVector: Uint8Array | ArrayBuffer;
}

export interface YjsSyncStep2Payload {
  docId: string;
  update: Uint8Array | ArrayBuffer;
}

export interface YjsUpdatePayload {
  docId: string;
  update: Uint8Array | ArrayBuffer;
}
