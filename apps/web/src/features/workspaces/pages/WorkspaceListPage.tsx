import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { httpClient } from "../../../shared/api/http-client.js";
import { WorkspaceDto, PlanDto } from "@collab-planner/shared";
import { Folder, Plus, FileText, ChevronRight, UserPlus, Trash2, Edit2, CheckCircle2, AlertCircle, LogOut } from "lucide-react";
import { Spinner } from "../../../shared/ui/spinner/Spinner.js";
import { useAuth } from "../../../app/providers/AuthProvider.js";
import { useWorkspaceStore, WorkspaceUiState } from "../stores/workspace-ui.store.js";

interface WorkspaceWithPlans extends WorkspaceDto {
  plans: PlanDto[];
  loadingPlans: boolean;
}

export const WorkspaceListPage: React.FC = () => {
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId?: string }>();
  const { user: currentUser } = useAuth();
  const setActiveWorkspaceId = useWorkspaceStore((state: WorkspaceUiState) => state.setActiveWorkspaceId);
  const triggerWorkspaceListReload = useWorkspaceStore((state: WorkspaceUiState) => state.triggerWorkspaceListReload);

  const [workspaces, setWorkspaces] = useState<WorkspaceWithPlans[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const reload = () => setReloadTrigger((prev) => prev + 1);
  
  // Board creation modal states
  const [showNewBoardModal, setShowNewBoardModal] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardDesc, setNewBoardDesc] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Invite member states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteLoading, setInviteLoading] = useState(false);

  // Edit workspace states
  const [showEditWorkspaceModal, setShowEditWorkspaceModal] = useState(false);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editingWorkspaceName, setEditingWorkspaceName] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Custom Confirmation Dialog Modal states
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    confirmStyle?: "danger" | "warning" | "primary";
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    onConfirm: () => {},
  });

  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Unified load workspaces & plans effect with active request guard
  useEffect(() => {
    let active = true;
    setLoading(true);
    setWorkspaces([]);

    const loadData = async () => {
      try {
        const res = await httpClient.get("/workspaces");
        if (!active) return;

        const wsList: WorkspaceDto[] = res.data?.data || [];
        const filteredWs = workspaceId
          ? wsList.filter((w) => w.id === workspaceId)
          : wsList;

        const wsWithPlans: WorkspaceWithPlans[] = filteredWs.map((ws) => ({
          ...ws,
          plans: [],
          loadingPlans: true,
        }));

        setWorkspaces(wsWithPlans);
        setLoading(false);

        await Promise.all(
          wsWithPlans.map(async (ws, index) => {
            try {
              const plansRes = await httpClient.get(`/workspaces/${ws.id}/plans`);
              if (!active) return;

              setWorkspaces((prev) => {
                const updated = [...prev];
                if (updated[index]) {
                  updated[index] = {
                    ...updated[index],
                    plans: plansRes.data?.data || [],
                    loadingPlans: false,
                  };
                }
                return updated;
              });
            } catch (err) {
              console.error(`Failed to fetch plans for workspace ${ws.id}:`, err);
              if (!active) return;
              setWorkspaces((prev) => {
                const updated = [...prev];
                if (updated[index]) {
                  updated[index] = { ...updated[index], loadingPlans: false };
                }
                return updated;
              });
            }
          })
        );
      } catch (err) {
        console.error("Failed to load workspaces:", err);
        if (active) setLoading(false);
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [workspaceId, reloadTrigger]);

  const getUserRole = (ws: WorkspaceDto): "owner" | "admin" | "member" | null => {
    if (!currentUser) return null;
    if (ws.ownerId === currentUser.id) return "owner";
    const member = ws.members.find((m) => m.userId === currentUser.id);
    return member?.role || null;
  };

  const handleDeleteWorkspace = (workspaceId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Workspace",
      message: "Are you sure you want to delete this workspace? This will permanently wipe all its plans, Yjs snapshots, and CRDT update logs!",
      confirmLabel: "Delete Workspace",
      cancelLabel: "Cancel",
      confirmStyle: "danger",
      onConfirm: async () => {
        try {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          setLoading(true);
          await httpClient.delete(`/workspaces/${workspaceId}`);
          showToast("Workspace deleted successfully!", "success");
          setActiveWorkspaceId(null);
          triggerWorkspaceListReload();
          navigate("/");
          reload();
        } catch (err: any) {
          console.error("Failed to delete workspace:", err);
          showToast("Failed to delete workspace: " + (err.response?.data?.error?.message || err.message), "error");
          setLoading(false);
        }
      },
    });
  };

  const handleLeaveWorkspace = (workspaceId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Leave Workspace",
      message: "Are you sure you want to leave this workspace? You will no longer have access to its plans!",
      confirmLabel: "Leave Workspace",
      cancelLabel: "Cancel",
      confirmStyle: "warning",
      onConfirm: async () => {
        try {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          setLoading(true);
          await httpClient.post(`/workspaces/${workspaceId}/leave`);
          showToast("Left workspace successfully!", "success");
          setActiveWorkspaceId(null);
          triggerWorkspaceListReload();
          navigate("/");
          reload();
        } catch (err: any) {
          console.error("Failed to leave workspace:", err);
          showToast("Failed to leave workspace: " + (err.response?.data?.error?.message || err.message), "error");
          setLoading(false);
        }
      },
    });
  };

  const handleDeletePlan = (planId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Plan Board",
      message: "Are you sure you want to delete this board plan? This will permanently erase all its data, snapshots, and update logs!",
      confirmLabel: "Delete Board",
      cancelLabel: "Cancel",
      confirmStyle: "danger",
      onConfirm: async () => {
        try {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          await httpClient.delete(`/plans/${planId}`);
          showToast("Plan board deleted successfully!", "success");
          reload();
        } catch (err: any) {
          console.error("Failed to delete plan board:", err);
          showToast("Failed to delete plan: " + (err.response?.data?.error?.message || err.message), "error");
        }
      },
    });
  };

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkspaceId || !newBoardName.trim()) return;

    try {
      setCreateLoading(true);
      await httpClient.post(`/workspaces/${selectedWorkspaceId}/plans`, {
        name: newBoardName,
        description: newBoardDesc
      });
      
      setNewBoardName("");
      setNewBoardDesc("");
      setShowNewBoardModal(false);
      
      // Reload everything
      reload();
    } catch (err) {
      console.error("Failed to create plan board:", err);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkspaceId || !inviteEmail.trim()) return;

    try {
      setInviteLoading(true);
      await httpClient.post(`/workspaces/${selectedWorkspaceId}/invite`, {
        email: inviteEmail,
        role: inviteRole
      });
      
      setInviteEmail("");
      setShowInviteModal(false);
      showToast("Invitation sent successfully!", "success");
      reload();
    } catch (err: any) {
      console.error("Failed to invite member:", err);
      showToast("Failed to invite: " + (err.response?.data?.error?.message || err.message), "error");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleUpdateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkspaceId || !editingWorkspaceName.trim()) return;

    try {
      setEditLoading(true);
      await httpClient.patch(`/workspaces/${editingWorkspaceId}`, {
        name: editingWorkspaceName,
      });
      
      setEditingWorkspaceId(null);
      setEditingWorkspaceName("");
      setShowEditWorkspaceModal(false);
      triggerWorkspaceListReload();
      
      // Reload workspaces
      reload();
    } catch (err: any) {
      console.error("Failed to update workspace:", err);
      showToast("Failed to update workspace: " + (err.response?.data?.error?.message || err.message), "error");
    } finally {
      setEditLoading(false);
    }
  };



  if (loading) {
    return (
      <div className="page-loading">
        <Spinner size="large" />
        <p>Loading workspaces...</p>
      </div>
    );
  }

  return (
    <div className="workspaces-page">
      <div className="page-header">
        <h1>Workspace Hub</h1>
        <p>Manage workspaces, board members, and collaborative plan boards.</p>
      </div>

      <div className="workspaces-grid">
        {workspaces.map((ws) => (
          <section key={ws.id} className="workspace-section">
            <div className="workspace-header">
              <div className="workspace-title-area">
                <Folder className="workspace-icon" />
                <h2>{ws.name}</h2>
                <span className="members-badge">{ws.members.length} members</span>
              </div>
              
              <div className="workspace-actions" style={{ display: "flex", gap: 8 }}>
                {getUserRole(ws) !== "member" && (
                  <button
                    className="icon-action-btn"
                    title="Edit Workspace"
                    onClick={() => {
                      setEditingWorkspaceId(ws.id);
                      setEditingWorkspaceName(ws.name);
                      setShowEditWorkspaceModal(true);
                    }}
                  >
                    <Edit2 size={16} />
                    <span>Edit</span>
                  </button>
                )}
                <button
                  className="icon-action-btn"
                  title="Invite Member"
                  onClick={() => {
                    setSelectedWorkspaceId(ws.id);
                    setShowInviteModal(true);
                  }}
                >
                  <UserPlus size={16} />
                  <span>Invite</span>
                </button>
                {getUserRole(ws) === "owner" ? (
                  <button
                    className="icon-action-btn"
                    title="Delete Workspace"
                    onClick={() => handleDeleteWorkspace(ws.id)}
                    style={{ color: "#ef4444" }}
                  >
                    <Trash2 size={16} />
                    <span>Delete</span>
                  </button>
                ) : (
                  <button
                    className="icon-action-btn"
                    title="Leave Workspace"
                    onClick={() => handleLeaveWorkspace(ws.id)}
                    style={{ color: "#f97316" }}
                  >
                    <LogOut size={16} />
                    <span>Leave</span>
                  </button>
                )}
              </div>
            </div>

            {ws.loadingPlans ? (
              <div className="workspace-plans-loading">
                <Spinner size="medium" />
              </div>
            ) : (
              <div className="plans-grid">
                {ws.plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="plan-card"
                    onClick={() => navigate(`/plans/${plan.id}`)}
                    style={{ position: "relative" }}
                  >
                    <div className="plan-card-icon">
                      <FileText size={24} />
                    </div>
                    <div className="plan-card-body">
                      <h3>{plan.name}</h3>
                      <p>{plan.description || "No description provided."}</p>
                    </div>
                    {getUserRole(ws) === "owner" && (
                      <button
                        className="plan-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePlan(plan.id);
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                          padding: 4,
                          display: "flex",
                          alignItems: "center",
                          borderRadius: 4,
                          marginRight: 8,
                          zIndex: 10,
                          transition: "color 0.2s, background-color 0.2s"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "#ef4444";
                          e.currentTarget.style.backgroundColor = "#fee2e2";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "#94a3b8";
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                        title="Delete Plan Board"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    <div className="plan-card-arrow">
                      <ChevronRight size={18} />
                    </div>
                  </div>
                ))}

                <button
                  className="add-plan-card"
                  onClick={() => {
                    setSelectedWorkspaceId(ws.id);
                    setShowNewBoardModal(true);
                  }}
                >
                  <Plus size={24} />
                  <span>Create Plan Board</span>
                </button>
              </div>
            )}
          </section>
        ))}
      </div>

      {/* 1. Create Board Modal */}
      {showNewBoardModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h2>Create New Plan Board</h2>
            <form onSubmit={handleCreateBoard}>
              <div className="form-group">
                <label>Board Name</label>
                <input
                  type="text"
                  placeholder="Enter board title (e.g. Q3 Sprint Backlog)"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  placeholder="Describe the scope of this collaborative planner..."
                  value={newBoardDesc}
                  onChange={(e) => setNewBoardDesc(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-btn btn-secondary"
                  onClick={() => setShowNewBoardModal(false)}
                  disabled={createLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-btn btn-primary"
                  disabled={createLoading || !newBoardName.trim()}
                >
                  {createLoading ? "Creating..." : "Create Board"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Invite Member Modal */}
      {showInviteModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h2>Invite Member to Workspace</h2>
            <form onSubmit={handleInviteMember}>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="collaborator@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-btn btn-secondary"
                  onClick={() => setShowInviteModal(false)}
                  disabled={inviteLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-btn btn-primary"
                  disabled={inviteLoading || !inviteEmail.trim()}
                >
                  {inviteLoading ? "Inviting..." : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Edit Workspace Modal */}
      {showEditWorkspaceModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h2>Edit Workspace</h2>
            <form onSubmit={handleUpdateWorkspace}>
              <div className="form-group">
                <label>Workspace Name</label>
                <input
                  type="text"
                  placeholder="Enter workspace name"
                  value={editingWorkspaceName}
                  onChange={(e) => setEditingWorkspaceName(e.target.value)}
                  required
                  autoFocus
                  disabled={editingWorkspaceId ? getUserRole(workspaces.find(w => w.id === editingWorkspaceId)!) === "member" : false}
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-btn btn-secondary"
                  onClick={() => setShowEditWorkspaceModal(false)}
                  disabled={editLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-btn btn-primary"
                  disabled={editLoading || !editingWorkspaceName.trim() || (editingWorkspaceId ? getUserRole(workspaces.find(w => w.id === editingWorkspaceId)!) === "member" : false)}
                >
                  {editLoading ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }}>
          <div className="modal-card" style={{ maxWidth: 450 }}>
            <h2 style={{
              color: confirmModal.confirmStyle === "danger" ? "#ef4444" : confirmModal.confirmStyle === "warning" ? "#f97316" : "inherit",
              marginTop: 0,
              fontSize: 20
            }}>
              {confirmModal.title}
            </h2>
            <div style={{
              margin: "16px 0",
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.6
            }}>
              {confirmModal.message}
            </div>
            <div className="modal-actions" style={{ justifyContent: "flex-end", gap: 12 }}>
              <button
                type="button"
                className="modal-btn btn-secondary"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid var(--border-color)",
                  cursor: "pointer",
                  fontSize: 14
                }}
              >
                {confirmModal.cancelLabel}
              </button>
              <button
                type="button"
                className="modal-btn"
                onClick={() => confirmModal.onConfirm()}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  backgroundColor: confirmModal.confirmStyle === "danger" ? "#ef4444" : confirmModal.confirmStyle === "warning" ? "#f97316" : "var(--primary-color)",
                  color: "#ffffff"
                }}
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`custom-toast ${toast.type}`}>
          {toast.type === "success" ? <CheckCircle2 size={16} style={{ color: "#10b981" }} /> : <AlertCircle size={16} style={{ color: "#ef4444" }} />}
          <div style={{ fontSize: 13, fontWeight: 500 }}>{toast.message}</div>
        </div>
      )}
    </div>
  );
};
