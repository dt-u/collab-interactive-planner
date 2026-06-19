import React, { useEffect, useState } from "react";
import { Outlet, Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider.js";
import { httpClient } from "../../shared/api/http-client.js";
import { WorkspaceDto } from "@collab-planner/shared";
import { LayoutDashboard, Plus, LogOut, Folder, FileText, Bell, User } from "lucide-react";
import { Spinner } from "../../shared/ui/spinner/Spinner.js";

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [workspaces, setWorkspaces] = useState<WorkspaceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Load workspaces of current user
  const fetchWorkspaces = async () => {
    try {
      const res = await httpClient.get("/workspaces");
      setWorkspaces(res.data?.data || []);
    } catch (err) {
      console.error("❌ Failed to fetch user workspaces:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    try {
      setCreateLoading(true);
      await httpClient.post("/workspaces", { name: newWorkspaceName });
      setNewWorkspaceName("");
      setShowNewWorkspaceModal(false);
      await fetchWorkspaces();
    } catch (err) {
      console.error("❌ Failed to create workspace:", err);
    } finally {
      setCreateLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  return (
    <div className="app-layout">
      {/* 1. Sidebar Navigation */}
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">ICP</span>
          <span className="brand-name">Interactive Planner</span>
        </div>

        <nav className="sidebar-nav">
          <Link
            to="/"
            className={`nav-item ${location.pathname === "/" ? "active" : ""}`}
          >
            <LayoutDashboard size={18} />
            <span>All Workspaces</span>
          </Link>

          <div className="nav-divider">Workspaces</div>

          {loading ? (
            <div className="sidebar-loading">
              <Spinner size="small" />
            </div>
          ) : (
            <div className="sidebar-workspace-list">
              {workspaces.map((ws) => (
                <div key={ws.id} className="workspace-item-group">
                  <div className="workspace-item-header">
                    <Folder size={16} />
                    <span className="workspace-name-text">{ws.name}</span>
                  </div>
                </div>
              ))}

              <button
                className="add-workspace-btn"
                onClick={() => setShowNewWorkspaceModal(true)}
              >
                <Plus size={16} />
                <span>New Workspace</span>
              </button>
            </div>
          )}
        </nav>

        {/* Sidebar Footer / Profile */}
        <div className="sidebar-footer">
          <div className="profile-badge">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="profile-img" />
            ) : (
              <div className="profile-placeholder">
                <User size={16} />
              </div>
            )}
            <div className="profile-info">
              <span className="profile-name">{user?.name}</span>
              <span className="profile-email">{user?.email}</span>
            </div>
          </div>

          <button className="logout-btn" onClick={logout} title="Sign Out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* 2. Main Work Area */}
      <div className="app-content-wrapper">
        <header className="app-header">
          <div className="header-breadcrumbs">
            <span className="breadcrumb-current">Dashboard</span>
          </div>

          <div className="header-actions">
            <button className="header-icon-btn" title="Notifications">
              <Bell size={20} />
              <span className="notification-badge"></span>
            </button>
          </div>
        </header>

        <main className="app-main">
          <Outlet />
        </main>
      </div>

      {/* 3. Add Workspace Modal Overlay */}
      {showNewWorkspaceModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h2>Create New Workspace</h2>
            <form onSubmit={handleCreateWorkspace}>
              <div className="form-group">
                <label>Workspace Name</label>
                <input
                  type="text"
                  placeholder="Enter workspace name (e.g. Development Team)"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-btn btn-secondary"
                  onClick={() => setShowNewWorkspaceModal(false)}
                  disabled={createLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-btn btn-primary"
                  disabled={createLoading || !newWorkspaceName.trim()}
                >
                  {createLoading ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
