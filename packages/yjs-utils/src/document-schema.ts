import * as Y from "yjs";

export const YJS_KEYS = {
  BOARD_INFO: "boardInfo",
  COLUMNS: "columns",
  ITEMS: "items",
  COLUMN_ORDER: "columnOrder",
  COLUMN_METADATA: "columnMetadata",
} as const;

export interface YjsBoardInfo {
  name: string;
  description?: string;
}

export interface YjsPlannerItem {
  id: string;
  title: string;
  description?: string;
  status: string; // maps to dynamic columnId/dayId
  assignees: string[];
  time?: string;  // e.g. "10:00 AM"
  cost?: string;  // e.g. "300k VND"
  image?: string; // thumbnail or card cover URL
  commentCount?: number;
}

export function initYjsDoc(doc: Y.Doc): void {
  doc.getMap(YJS_KEYS.BOARD_INFO);
  doc.getMap(YJS_KEYS.COLUMNS);
  doc.getMap(YJS_KEYS.ITEMS);
  doc.getArray(YJS_KEYS.COLUMN_ORDER);
  doc.getMap(YJS_KEYS.COLUMN_METADATA);
}

export function getSharedBoardInfo(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(YJS_KEYS.BOARD_INFO);
}

export function getSharedColumns(doc: Y.Doc): Y.Map<Y.Array<string>> {
  return doc.getMap(YJS_KEYS.COLUMNS) as Y.Map<Y.Array<string>>;
}

export function getSharedItems(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return doc.getMap(YJS_KEYS.ITEMS) as Y.Map<Y.Map<unknown>>;
}

export function getSharedColumnOrder(doc: Y.Doc): Y.Array<string> {
  return doc.getArray(YJS_KEYS.COLUMN_ORDER);
}

export function getSharedColumnMetadata(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(YJS_KEYS.COLUMN_METADATA);
}
