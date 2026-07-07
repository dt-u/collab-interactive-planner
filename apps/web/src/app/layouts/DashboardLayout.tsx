import React, { useEffect, useState } from "react";
import { Outlet, Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider.js";
import { httpClient } from "../../shared/api/http-client.js";
import { WorkspaceDto } from "@collab-planner/shared";
import { LayoutDashboard, Plus, LogOut, Folder, FileText, Bell, User, Menu, ArrowLeft } from "lucide-react";
import { Spinner } from "../../shared/ui/spinner/Spinner.js";
import { useWorkspaceStore } from "../../features/workspaces/stores/workspace-ui.store.js";
import { useSocketConnection } from "../../features/realtime/hooks/useSocketConnection.js";
import { useNotificationStore } from "../../features/notifications/stores/notification.store.js";

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [workspaces, setWorkspaces] = useState<WorkspaceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const { workspaceId, planId } = useParams<{ workspaceId?: string; planId?: string }>();
  const { activeWorkspaceId, setActiveWorkspaceId, workspaceListVersion, triggerWorkspaceListReload } = useWorkspaceStore();

  useEffect(() => {
    if (workspaceId) {
      setActiveWorkspaceId(workspaceId);
    } else {
      setActiveWorkspaceId(null);
    }
  }, [workspaceId, setActiveWorkspaceId]);

  const socket = useSocketConnection();
  const { unreadCount, addNotification, setNotifications, resetUnreadCount } = useNotificationStore();

  // Fetch unread notifications on mount
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await httpClient.get("/notifications");
        setNotifications(res.data?.data || []);
      } catch (err) {
        console.error("Failed to fetch initial notifications:", err);
      }
    };
    fetchNotifications();
  }, [setNotifications]);

  // Handle incoming realtime notification socket events
  useEffect(() => {
    if (!socket) return;

    const handleNotificationReceived = (notification: any) => {
      addNotification(notification);
      // Trigger list update if invite arrived
      if (notification.type === "invitation") {
        triggerWorkspaceListReload();
      }
    };

    socket.on("notification:received", handleNotificationReceived);
    return () => {
      socket.off("notification:received", handleNotificationReceived);
    };
  }, [socket, addNotification, triggerWorkspaceListReload]);

  // Collapsible sidebar state (persisted in localStorage)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("sidebar_collapsed") === "true";
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  };

  // Load workspaces of current user
  const fetchWorkspaces = async () => {
    try {
      const res = await httpClient.get("/workspaces");
      setWorkspaces(res.data?.data || []);
    } catch (err) {
      console.error("Failed to fetch user workspaces:", err);
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
      triggerWorkspaceListReload();
    } catch (err) {
      console.error("Failed to create workspace:", err);
    } finally {
      setCreateLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [workspaceListVersion]);

  return (
    <div className="app-layout">
      {/* 1. Sidebar Navigation */}
      <aside className={`app-sidebar ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-brand" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, overflow: "hidden" }}>
            <span className="brand-icon">PU</span>
            <span className="brand-name" style={{ whiteSpace: "nowrap" }}>PACKUP</span>
          </div>
          <button 
            onClick={toggleSidebar}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            className="sidebar-collapse-btn"
            title="Collapse Sidebar"
          >
            <ArrowLeft size={16} />
          </button>
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
                <div
                  key={ws.id}
                  className={`workspace-item-group ${activeWorkspaceId === ws.id ? "active" : ""}`}
                  onClick={() => {
                    setActiveWorkspaceId(ws.id);
                    navigate(`/workspace/${ws.id}`);
                  }}
                  style={{ cursor: "pointer" }}
                >
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
        {!planId && (
          <header className="app-header">
            <div className="header-breadcrumbs" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {isSidebarCollapsed && (
                <button 
                  onClick={toggleSidebar}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: 4,
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Expand Sidebar"
                >
                  <Menu size={18} />
                </button>
              )}
              <span className="breadcrumb-current">Dashboard</span>
            </div>

            <div className="header-actions">
              <button
                className="header-icon-btn"
                style={{ position: "relative" }}
                title="Notifications"
                onClick={() => {
                  resetUnreadCount();
                  navigate("/notifications");
                }}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="notification-badge" style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    backgroundColor: "#ef4444",
                    color: "#ffffff",
                    borderRadius: "50%",
                    fontSize: 10,
                    fontWeight: "bold",
                    minWidth: 16,
                    height: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 4px"
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </header>
        )}

        <main className={`app-main ${planId ? "whiteboard-mode" : ""}`} style={planId ? { height: "100%", padding: 0, overflow: "hidden" } : undefined}>
          <Outlet context={{ isSidebarCollapsed, toggleSidebar }} />
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
