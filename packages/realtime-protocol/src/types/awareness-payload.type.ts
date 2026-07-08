export interface UserPresence {
  userId: string;
  name: string;
  avatarUrl?: string;
  color: string; // Coloured cursor identifier
}

export interface CursorPosition {
  x: number;
  y: number;
}

export interface SelectionRange {
  anchor: number;
  head: number;
}

export interface DragProgress {
  itemId: string;
  type: string; // 'TASK' | 'COLUMN'
  x: number;
  y: number;
}

export interface AwarenessState {
  user: UserPresence;
  cursor?: CursorPosition;
  focusedItemId?: string;
  selection?: SelectionRange;
  dragProgress?: DragProgress;
}

export interface AwarenessPayload {
  clientId: number;
  state: AwarenessState;
}
