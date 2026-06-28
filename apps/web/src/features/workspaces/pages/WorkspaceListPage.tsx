import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { httpClient } from "../../../shared/api/http-client.js";
import { WorkspaceDto, PlanDto } from "@collab-planner/shared";
import { Folder, Plus, FileText, ChevronRight, UserPlus, Trash2, Edit2, CheckCircle2, AlertCircle } from "lucide-react";
import { Spinner } from "../../../shared/ui/spinner/Spinner.js";

interface WorkspaceWithPlans extends WorkspaceDto {
  plans: PlanDto[];
  loadingPlans: boolean;
}

export const WorkspaceListPage: React.FC = () => {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<WorkspaceWithPlans[]>([]);
  const [loading, setLoading] = useState(true);
  
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

  const fetchWorkspacesAndPlans = async () => {
    try {
      const res = await httpClient.get("/workspaces");
      const wsList: WorkspaceDto[] = res.data?.data || [];
      
      const wsWithPlans: WorkspaceWithPlans[] = wsList.map(ws => ({
        ...ws,
        plans: [],
        loadingPlans: true
      }));
      
      setWorkspaces(wsWithPlans);
      setLoading(false);

      // Load plans in parallel for each workspace
      await Promise.all(
        wsWithPlans.map(async (ws, index) => {
          try {
            const plansRes = await httpClient.get(`/workspaces/${ws.id}/plans`);
            setWorkspaces(prev => {
              const updated = [...prev];
              updated[index] = {
                ...updated[index],
                plans: plansRes.data?.data || [],
                loadingPlans: false
              };
              return updated;
            });
          } catch (err) {
            console.error(`Failed to fetch plans for workspace ${ws.id}:`, err);
            setWorkspaces(prev => {
              const updated = [...prev];
              updated[index] = { ...updated[index], loadingPlans: false };
              return updated;
            });
          }
        })
      );
    } catch (err) {
      console.error("Failed to load workspaces:", err);
      setLoading(false);
    }
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
      await fetchWorkspacesAndPlans();
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
      await fetchWorkspacesAndPlans();
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
      
      // Reload workspaces
      await fetchWorkspacesAndPlans();
    } catch (err: any) {
      console.error("Failed to update workspace:", err);
      showToast("Failed to update workspace: " + (err.response?.data?.error?.message || err.message), "error");
    } finally {
      setEditLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspacesAndPlans();
  }, []);

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
                  >
                    <div className="plan-card-icon">
                      <FileText size={24} />
                    </div>
                    <div className="plan-card-body">
                      <h3>{plan.name}</h3>
                      <p>{plan.description || "No description provided."}</p>
                    </div>
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
                  disabled={editLoading || !editingWorkspaceName.trim()}
                >
                  {editLoading ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
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
