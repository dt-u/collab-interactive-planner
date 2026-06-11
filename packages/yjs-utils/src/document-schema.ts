import * as Y from "yjs";

export const YJS_KEYS = {
  BOARD_INFO: "boardInfo",
  COLUMNS: "columns",
  ITEMS: "items",
} as const;

export interface YjsBoardInfo {
  name: string;
  description?: string;
}

export interface YjsPlannerItem {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "done";
  assignees: string[];
}

export function initYjsDoc(doc: Y.Doc): void {
  doc.getMap(YJS_KEYS.BOARD_INFO);
  doc.getMap(YJS_KEYS.COLUMNS);
  doc.getMap(YJS_KEYS.ITEMS);
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
