import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { httpClient } from "../../../shared/api/http-client.js";
import { useNotificationStore } from "../stores/notification.store.js";
import { useWorkspaceStore } from "../../workspaces/stores/workspace-ui.store.js";
import { useAuth } from "../../../app/providers/AuthProvider.js";
import { Bell, Check, Mail, Calendar, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { Spinner } from "../../../shared/ui/spinner/Spinner.js";

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const triggerWorkspaceListReload = useWorkspaceStore((state: any) => state.triggerWorkspaceListReload);
  const { setNotifications, notifications, resetUnreadCount } = useNotificationStore();

  const [activeTab, setActiveTab] = useState<"invitations" | "all">("invitations");
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [invRes, notifRes] = await Promise.all([
        httpClient.get("/workspaces/invitations/pending"),
        httpClient.get("/notifications"),
      ]);
      setPendingInvitations(invRes.data?.data || []);
      setNotifications(notifRes.data?.data || []);
    } catch (err) {
      console.error("Failed to load notifications page data:", err);
    }
  };

  useEffect(() => {
    const initPage = async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
      
      // Clear the bell icon badge count immediately when entering the notification page
      resetUnreadCount();
      try {
        await httpClient.patch("/notifications/read-all");
      } catch (err) {
        console.error("Failed to mark all as read automatically on mount:", err);
      }
    };
    initPage();
  }, []);

  const handleAcceptInvitation = async (invitationId: string) => {
    try {
      setActionLoadingId(invitationId);
      await httpClient.post(`/workspaces/invitations/${invitationId}/accept`);
      triggerWorkspaceListReload();
      await loadData();
    } catch (err) {
      console.error("Failed to accept invitation:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    try {
      setActionLoadingId(invitationId);
      await httpClient.post(`/workspaces/invitations/${invitationId}/decline`);
      triggerWorkspaceListReload();
      await loadData();
    } catch (err) {
      console.error("Failed to decline invitation:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await httpClient.patch(`/notifications/${notificationId}/read`);
      await loadData();
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "500px",
        backgroundColor: "#0c0c0e"
      }}>
        <Spinner size="large" />
        <p style={{ marginTop: "1rem", color: "#94a3b8", fontWeight: 500, fontSize: "0.875rem", letterSpacing: "0.05em" }}>
          LOADING NOTIFICATIONS
        </p>
      </div>
    );
  }

  const unreadGeneralCount = notifications.filter((n) => !n.read && n.type !== "invitation").length;

  return (
    <div style={{
      padding: "2rem",
      maxWidth: "1200px",
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      gap: "1.5rem",
      color: "#e2e8f0"
    }}>
      
      {/* Header Actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          onClick={() => navigate("/")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            backgroundColor: "rgba(30, 41, 59, 0.6)",
            color: "#f1f5f9",
            fontSize: "0.875rem",
            fontWeight: 500,
            borderRadius: "0.75rem",
            border: "1px solid rgba(71, 85, 105, 0.5)",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(71, 85, 105, 0.8)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(30, 41, 59, 0.6)";
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Hub</span>
        </button>
      </div>

      {/* Grid Layout: Profile Sidebar & Feed */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
        gap: "2rem",
        alignItems: "start"
      }}>
        
        {/* Left Side: Profile Identity Card & Stats */}
        <div style={{ gridColumn: "span 4", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* User Identity Profile Card */}
          <div style={{
            display: "flex",
            alignItems: "start",
            gap: "1.5rem",
            padding: "1.25rem",
            backgroundColor: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: "1rem",
            border: "1px solid rgba(51, 65, 85, 0.8)",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)"
          }}>
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                style={{ width: "3rem", height: "3rem", borderRadius: "50%", border: "1px solid rgba(148, 163, 184, 0.3)" }}
              />
            ) : (
              <div style={{
                width: "3rem",
                height: "3rem",
                borderRadius: "50%",
                backgroundColor: "rgba(99, 102, 241, 0.1)",
                border: "1px solid rgba(99, 102, 241, 0.2)",
                color: "#818cf8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                fontSize: "1.125rem"
              }}>
                {currentUser?.name?.slice(0, 2).toUpperCase() || "US"}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2 style={{ fontWeight: "bold", color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "1rem", lineHeight: "1.25" }}>
                {currentUser?.name}
              </h2>
              <p style={{ fontSize: "0.75rem", color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "0.25rem" }}>
                {currentUser?.email}
              </p>
            </div>
          </div>

          {/* Stats details nested cleanly underneath */}
          <div style={{
            padding: "1.25rem",
            backgroundColor: "rgba(15, 23, 42, 0.2)",
            borderRadius: "1rem",
            border: "1px solid rgba(51, 65, 85, 0.4)",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255, 255, 255, 0.05)", paddingBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.875rem", color: "#94a3b8", fontWeight: 500 }}>Pending Invites</span>
              <span style={{
                padding: "0.125rem 0.5rem",
                fontSize: "0.75rem",
                backgroundColor: "rgba(99, 102, 241, 0.2)",
                color: "#c7d2fe",
                borderRadius: "0.375rem",
                fontWeight: 600,
                marginLeft: "auto"
              }}>
                {pendingInvitations.length}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.875rem", color: "#94a3b8", fontWeight: 500 }}>System Logs</span>
              <span style={{
                padding: "0.125rem 0.5rem",
                fontSize: "0.75rem",
                backgroundColor: "rgba(148, 163, 184, 0.2)",
                color: "#cbd5e1",
                borderRadius: "0.375rem",
                fontWeight: 600,
                marginLeft: "auto"
              }}>
                {unreadGeneralCount}
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Tab Controls & Main Scrollable Feed */}
        <div style={{ gridColumn: "span 8", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* Segmented Tab Navigation Controller */}
          <div style={{
            display: "flex",
            gap: "0.5rem",
            padding: "0.25rem",
            backgroundColor: "rgba(2, 6, 23, 0.6)",
            borderRadius: "0.75rem",
            border: "1px solid rgba(51, 65, 85, 0.8)",
            maxWidth: "280px"
          }}>
            <button
              onClick={() => setActiveTab("invitations")}
              style={{
                flex: 1,
                padding: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                borderRadius: "0.5rem",
                backgroundColor: activeTab === "invitations" ? "#4f46e5" : "transparent",
                color: activeTab === "invitations" ? "#ffffff" : "#94a3b8",
                border: "none",
                cursor: "pointer",
                boxShadow: activeTab === "invitations" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                transition: "all 0.2s"
              }}
            >
              Invitations
            </button>
            <button
              onClick={() => setActiveTab("all")}
              style={{
                flex: 1,
                padding: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                borderRadius: "0.5rem",
                backgroundColor: activeTab === "all" ? "#4f46e5" : "transparent",
                color: activeTab === "all" ? "#ffffff" : "#94a3b8",
                border: "none",
                cursor: "pointer",
                boxShadow: activeTab === "all" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                transition: "all 0.2s"
              }}
            >
              Logs
            </button>
          </div>

          {/* Feed Container */}
          <div style={{
            maxHeight: "550px",
            overflowY: "auto",
            paddingRight: "0.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem"
          }}>
            {activeTab === "invitations" && (
              <>
                {pendingInvitations.length === 0 ? (
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    padding: "3rem",
                    backgroundColor: "rgba(15, 23, 42, 0.2)",
                    borderRadius: "1rem",
                    border: "1px dashed rgba(51, 65, 85, 0.6)",
                    marginTop: "2rem"
                  }}>
                    <Mail size={48} style={{ color: "rgba(148, 163, 184, 0.5)", marginBottom: "1rem" }} />
                    <h3 style={{ fontWeight: 600, color: "#94a3b8", fontSize: "1rem" }}>Inbox Clear</h3>
                    <p style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "0.25rem", maxWidth: "250px" }}>
                      No pending workspace invitations right now.
                    </p>
                  </div>
                ) : (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                    gap: "1rem"
                  }}>
                    {pendingInvitations.map((inv) => (
                      <div
                        key={inv.id}
                        style={{
                          position: "relative",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          height: "200px",
                          padding: "1.25rem",
                          backgroundColor: "rgba(15, 23, 42, 0.3)",
                          borderRadius: "1rem",
                          border: "1px solid rgba(51, 65, 85, 0.6)",
                          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)"
                        }}
                      >
                        <div style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: "4px",
                          backgroundColor: "#4f46e5",
                          borderTopLeftRadius: "1rem",
                          borderBottomLeftRadius: "1rem"
                        }} />
                        
                        <div>
                          <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.5rem" }}>
                            <h3 style={{ fontWeight: "bold", color: "#ffffff", fontSize: "1.125rem", lineHeight: "1.2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {inv.workspaceName}
                            </h3>
                            <span style={{
                              fontSize: "10px",
                              fontWeight: "bold",
                              backgroundColor: "rgba(99, 102, 241, 0.2)",
                              color: "#c7d2fe",
                              border: "1px solid rgba(99, 102, 241, 0.3)",
                              padding: "0.125rem 0.5rem",
                              borderRadius: "9999px",
                              textTransform: "capitalize"
                            }}>
                              {inv.role}
                            </span>
                          </div>
                          
                          <p style={{ fontSize: "0.75rem", color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            Invited by <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{inv.inviterName}</span>
                          </p>
                          <p style={{ fontSize: "10px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "0.125rem" }}>
                            {inv.inviterEmail}
                          </p>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginTop: "1rem" }}>
                          <span style={{ fontSize: "10px", color: "#64748b", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                            <Calendar size={11} />
                            {new Date(inv.createdAt).toLocaleDateString()}
                          </span>

                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                              onClick={() => handleAcceptInvitation(inv.id)}
                              disabled={actionLoadingId === inv.id}
                              style={{
                                backgroundColor: "#4f46e5",
                                color: "#ffffff",
                                border: "none",
                                padding: "0.5rem 1rem",
                                borderRadius: "0.5rem",
                                fontWeight: 600,
                                fontSize: "0.875rem",
                                cursor: "pointer",
                                transition: "background-color 0.2s"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "#4338ca";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "#4f46e5";
                              }}
                            >
                              {actionLoadingId === inv.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                "Accept"
                              )}
                            </button>
                            <button
                              onClick={() => handleDeclineInvitation(inv.id)}
                              disabled={actionLoadingId === inv.id}
                              style={{
                                backgroundColor: "transparent",
                                color: "#94a3b8",
                                border: "1px solid rgba(148, 163, 184, 0.3)",
                                padding: "0.5rem 1rem",
                                borderRadius: "0.5rem",
                                fontWeight: 600,
                                fontSize: "0.875rem",
                                cursor: "pointer",
                                transition: "all 0.2s"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "rgba(148, 163, 184, 0.08)";
                                e.currentTarget.style.color = "#f1f5f9";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "transparent";
                                e.currentTarget.style.color = "#94a3b8";
                              }}
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === "all" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {notifications.length === 0 ? (
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    padding: "3rem",
                    backgroundColor: "rgba(15, 23, 42, 0.2)",
                    borderRadius: "1rem",
                    border: "1px dashed rgba(51, 65, 85, 0.6)",
                    marginTop: "2rem"
                  }}>
                    <Bell size={48} style={{ color: "rgba(148, 163, 184, 0.5)", marginBottom: "1rem" }} />
                    <h3 style={{ fontWeight: 600, color: "#94a3b8", fontSize: "1rem" }}>No notifications</h3>
                    <p style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "0.25rem", maxWidth: "250px" }}>
                      Updates and operation history logs will display here.
                    </p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      style={{
                        display: "flex",
                        gap: "1rem",
                        padding: "1rem",
                        backgroundColor: notif.read ? "rgba(15, 23, 42, 0.1)" : "rgba(15, 23, 42, 0.3)",
                        borderRadius: "1rem",
                        border: "1px solid rgba(51, 65, 85, 0.4)",
                        opacity: notif.read ? 0.6 : 1,
                        transition: "all 0.2s",
                        justifyContent: "space-between",
                        alignItems: "start"
                      }}
                    >
                      <div style={{ display: "flex", gap: "0.75rem" }}>
                        <div style={{
                          padding: "0.5rem",
                          borderRadius: "0.5rem",
                          marginTop: "0.125rem",
                          backgroundColor: notif.read ? "rgba(148, 163, 184, 0.1)" : "rgba(99, 102, 241, 0.15)",
                          color: notif.read ? "#64748b" : "#818cf8",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}>
                          <CheckCircle2 size={15} />
                        </div>
                        <div>
                          <h4 style={{ fontSize: "0.875rem", fontWeight: "bold", color: notif.read ? "#94a3b8" : "#ffffff", margin: 0 }}>
                            {notif.title}
                          </h4>
                          <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem", lineHeight: "1.4" }}>
                            {notif.content}
                          </p>
                          <span style={{ fontSize: "10px", color: "#64748b", marginTop: "0.5rem", display: "block" }}>
                            {new Date(notif.createdAt).toLocaleDateString()} at {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {!notif.read && (
                        <button
                          onClick={() => handleMarkAsRead(notif.id)}
                          style={{
                            padding: "0.375rem",
                            backgroundColor: "rgba(148, 163, 184, 0.1)",
                            border: "none",
                            color: "#94a3b8",
                            borderRadius: "0.375rem",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.2s"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(148, 163, 184, 0.2)";
                            e.currentTarget.style.color = "#f1f5f9";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(148, 163, 184, 0.1)";
                            e.currentTarget.style.color = "#94a3b8";
                          }}
                          title="Mark as read"
                        >
                          <Check size={14} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
