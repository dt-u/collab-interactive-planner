import { create } from "zustand";

export interface WorkspaceUiState {
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
  workspaceListVersion: number;
  triggerWorkspaceListReload: () => void;
}

export const useWorkspaceStore = create<WorkspaceUiState>((set) => ({
  activeWorkspaceId: null,
  setActiveWorkspaceId: (id: string | null) => set({ activeWorkspaceId: id }),
  workspaceListVersion: 0,
  triggerWorkspaceListReload: () => set((state: WorkspaceUiState) => ({ workspaceListVersion: state.workspaceListVersion + 1 })),
}));

export const workspaceUiStore = {
  useWorkspaceStore,
};
