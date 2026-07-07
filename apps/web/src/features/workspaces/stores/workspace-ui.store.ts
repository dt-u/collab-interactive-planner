import { create } from "zustand";

interface WorkspaceUiState {
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
  workspaceListVersion: number;
  triggerWorkspaceListReload: () => void;
}

export const useWorkspaceStore = create<WorkspaceUiState>((set) => ({
  activeWorkspaceId: null,
  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
  workspaceListVersion: 0,
  triggerWorkspaceListReload: () => set((state) => ({ workspaceListVersion: state.workspaceListVersion + 1 })),
}));

export const workspaceUiStore = {
  useWorkspaceStore,
};
