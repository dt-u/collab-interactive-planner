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

export interface AwarenessState {
  user: UserPresence;
  cursor?: CursorPosition;
  focusedItemId?: string;
  selection?: SelectionRange;
}

export interface AwarenessPayload {
  clientId: number;
  state: AwarenessState;
}
