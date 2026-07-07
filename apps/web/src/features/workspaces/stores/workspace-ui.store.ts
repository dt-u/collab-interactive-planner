import { create } from "zustand";

interface WorkspaceUiState {
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceUiState>((set) => ({
  activeWorkspaceId: null,
  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
}));

export const workspaceUiStore = {
  useWorkspaceStore,
};
