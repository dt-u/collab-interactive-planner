import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { getRandomCursorColor } from "../src/awareness.js";
import {
  initYjsDoc,
  getSharedBoardInfo,
  getSharedColumns,
  getSharedItems,
} from "../src/document-schema.js";
import { encodeStateAsUpdate, applyUpdateToDoc } from "../src/encode-update.js";
import {
  encodeStateVector,
  encodeStateAsUpdateWithVector,
} from "../src/state-vector.js";

describe("Yjs Utils - Awareness", () => {
  it("should return consistent cursor color for same user id", () => {
    const userId = "user-123";
    const color1 = getRandomCursorColor(userId);
    const color2 = getRandomCursorColor(userId);
    expect(color1).toBe(color2);
  });

  it("should assign valid colors for different user ids", () => {
    const colorA = getRandomCursorColor("user-a");
    const colorB = getRandomCursorColor("user-b");
    expect(colorA).toBeDefined();
    expect(colorB).toBeDefined();
  });
});

describe("Yjs Utils - Document Schema", () => {
  it("should initialize shared document maps correctly", () => {
    const doc = new Y.Doc();
    initYjsDoc(doc);

    const boardInfo = getSharedBoardInfo(doc);
    const columns = getSharedColumns(doc);
    const items = getSharedItems(doc);

    expect(boardInfo).toBeInstanceOf(Y.Map);
    expect(columns).toBeInstanceOf(Y.Map);
    expect(items).toBeInstanceOf(Y.Map);
  });
});

describe("Yjs Utils - Binary Serialization", () => {
  it("should serialize and apply document updates correctly", () => {
    const doc1 = new Y.Doc();
    initYjsDoc(doc1);

    const boardInfo1 = getSharedBoardInfo(doc1);
    boardInfo1.set("name", "Project Alpha");

    const updateBuffer = encodeStateAsUpdate(doc1);
    expect(updateBuffer).toBeInstanceOf(Buffer);

    const doc2 = new Y.Doc();
    initYjsDoc(doc2);
    applyUpdateToDoc(doc2, updateBuffer);

    const boardInfo2 = getSharedBoardInfo(doc2);
    expect(boardInfo2.get("name")).toBe("Project Alpha");
  });
});

describe("Yjs Utils - State Vector Sync", () => {
  it("should generate delta update based on state vector", () => {
    const doc1 = new Y.Doc();
    initYjsDoc(doc1);
    const boardInfo1 = getSharedBoardInfo(doc1);
    boardInfo1.set("name", "Version 1");

    const doc2 = new Y.Doc();
    initYjsDoc(doc2);
    const boardInfo2 = getSharedBoardInfo(doc2);
    boardInfo2.set("name", "Version 1");
    boardInfo2.set("description", "V1 details");

    const sv = encodeStateVector(doc1);
    const update = encodeStateAsUpdateWithVector(doc2, sv);

    applyUpdateToDoc(doc1, update);

    expect(boardInfo1.get("description")).toBe("V1 details");
  });
});
