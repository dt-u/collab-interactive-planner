import React, { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as Y from "yjs";
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useAuth } from "../../../app/providers/AuthProvider.js";
import { useJoinPlannerRoom } from "../../realtime/hooks/useJoinPlannerRoom.js";
import { SocketIoYjsProvider } from "../../collaborative-editor/yjs/socket-io-yjs-provider.js";
import { useYjsColumns } from "../../collaborative-editor/hooks/useYjsDocument.js";
import { useYjsAwareness } from "../../collaborative-editor/hooks/useYjsAwareness.js";
import {
  getSharedColumns,
  getSharedItems,
  getSharedColumnOrder,
  getSharedColumnMetadata,
} from "@collab-planner/yjs-utils";
import { httpClient } from "../../../shared/api/http-client.js";
import { BoardTaskCard } from "./BoardTaskCard.js";
import { TaskDetailModal } from "./TaskDetailModal.js";
import { Plus, ArrowLeft, Trash2, X, Copy } from "lucide-react";
import { Spinner } from "../../../shared/ui/spinner/Spinner.js";

// Helper to convert time strings (like "10:00 AM", "6:00 PM") to minutes for client-side sorting
const parseTimeToMinutes = (timeStr: string | undefined): number => {
  if (!timeStr) return 9999; // tasks without time go to the end
  const clean = timeStr.trim().toLowerCase();
  
  const match = clean.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (!match) {
    const simpleHour = parseInt(clean);
    if (!isNaN(simpleHour)) return simpleHour * 60;
    return 9999;
  }
  
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const ampm = match[3];
  
  if (ampm === "pm" && hours < 12) hours += 12;
  if (ampm === "am" && hours === 12) hours = 0;
  
  return hours * 60 + minutes;
};

export const KanbanBoard: React.FC = () => {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  // 1. Board Metadata
  const [boardDetails, setBoardDetails] = useState<{
    name: string;
    description?: string;
    workspaceId: string;
  } | null>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(true);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  // Fetch plan details to retrieve workspaceId
  useEffect(() => {
    const fetchPlanMetadata = async () => {
      try {
        setLoadingMetadata(true);
        const res = await httpClient.get(`/plans/${planId}`);
        const plan = res.data?.data;
        if (plan) {
          setBoardDetails({
            name: plan.name,
            description: plan.description,
            workspaceId: plan.workspaceId,
          });
        } else {
          setMetadataError("Plan not found");
        }
      } catch (err: any) {
        console.error("❌ Failed to fetch plan metadata:", err);
        setMetadataError(err.response?.data?.error?.message || "Failed to load plan metadata");
      } finally {
        setLoadingMetadata(false);
      }
    };

    if (planId) {
      fetchPlanMetadata();
    }
  }, [planId]);

  // 2. Room Joining
  const { joined, loading: joiningRoom, error: roomError, socket } = useJoinPlannerRoom(
    boardDetails?.workspaceId,
    planId
  );

  // 3. Yjs Document & Provider Setup
  const yDoc = useMemo(() => new Y.Doc(), [planId]);

  useEffect(() => {
    if (!socket || !joined || !planId) return;

    console.log(`🔌 Initializing SocketIoYjsProvider for plan: ${planId}`);
    const provider = new SocketIoYjsProvider(planId, yDoc, socket);

    // Initialize custom columns order and metadata in Yjs if they do not exist
    yDoc.transact(() => {
      const orderArray = getSharedColumnOrder(yDoc);
      const metadataMap = getSharedColumnMetadata(yDoc);
      const columnsMap = getSharedColumns(yDoc);

      if (orderArray.length === 0) {
        // Default itinerary days setup
        orderArray.push(["day_1", "day_2", "day_3"]);

        metadataMap.set("day_1", { id: "day_1", title: "DAY 1: EXPLORE" });
        metadataMap.set("day_2", { id: "day_2", title: "DAY 2: RELAX & EAT" });
        metadataMap.set("day_3", { id: "day_3", title: "DAY 3: NATURE" });

        if (!columnsMap.has("day_1")) columnsMap.set("day_1", new Y.Array<string>());
        if (!columnsMap.has("day_2")) columnsMap.set("day_2", new Y.Array<string>());
        if (!columnsMap.has("day_3")) columnsMap.set("day_3", new Y.Array<string>());
      }
    });

    return () => {
      provider.destroy();
    };
  }, [socket, joined, planId, yDoc]);

  // 4. Mutation Lock Guard & Dynamic Columns hook
  const [isDraggingLocal, setIsDraggingLocal] = useState(false);
  const { columns, columnOrder, columnMetadata } = useYjsColumns(yDoc, isDraggingLocal);

  // Column CRUD and Invite States
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnTitle, setEditingColumnTitle] = useState("");

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // 5. Awareness Layer
  const canvasRef = useRef<HTMLDivElement>(null);
  const { remoteCursors, updateFocusedItem } = useYjsAwareness(
    socket,
    planId,
    currentUser,
    canvasRef
  );

  // 6. Task Details Modal
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const handleOpenTaskDetails = (taskId: string) => {
    setActiveTaskId(taskId);
    updateFocusedItem(taskId);
  };

  const handleCloseTaskDetails = () => {
    setActiveTaskId(null);
    updateFocusedItem(undefined);
  };

  // 7. Drag-and-Drop Sensors configuration
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const findColumnOfTaskId = (taskId: string): string | null => {
    for (const [colId, taskIds] of Object.entries(columns)) {
      if (taskIds.includes(taskId)) {
        return colId;
      }
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setIsDraggingLocal(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setIsDraggingLocal(false);
    const { active, over } = event;

    if (!over || !yDoc) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const sourceCol = findColumnOfTaskId(activeId);
    let destCol = overId;

    if (!columnOrder.includes(destCol)) {
      destCol = findColumnOfTaskId(overId) || "";
    }

    if (!sourceCol || !destCol) return;

    const columnsMap = getSharedColumns(yDoc);
    const sourceArray = columnsMap.get(sourceCol);
    const destArray = columnsMap.get(destCol);

    if (!sourceArray || !destArray) return;

    const sourceIndex = columns[sourceCol].indexOf(activeId);
    let destIndex = 0;

    if (columnOrder.includes(overId)) {
      destIndex = columns[destCol].length;
    } else {
      destIndex = columns[destCol].indexOf(overId);
    }

    if (sourceCol === destCol && sourceIndex === destIndex) return;

    yDoc.transact(() => {
      if (sourceCol === destCol) {
        sourceArray.delete(sourceIndex);
        sourceArray.insert(destIndex, [activeId]);
      } else {
        sourceArray.delete(sourceIndex);
        destArray.insert(destIndex, [activeId]);

        const itemsMap = getSharedItems(yDoc);
        const itemMap = itemsMap.get(activeId) as Y.Map<any>;
        if (itemMap) {
          itemMap.set("status", destCol);
        }
      }
    });
  };

  // Create Task Action
  const handleCreateTask = (colId: string) => {
    if (!yDoc) return;

    const taskId = "task_" + Math.random().toString(36).substring(2, 11);
    const itemsMap = getSharedItems(yDoc);
    const columnsMap = getSharedColumns(yDoc);
    const columnArray = columnsMap.get(colId);

    if (!columnArray) return;

    yDoc.transact(() => {
      const taskMap = new Y.Map();
      taskMap.set("id", taskId);
      taskMap.set("title", "New Itinerary Item");
      taskMap.set("description", "");
      taskMap.set("status", colId);
      taskMap.set("assignees", []);
      taskMap.set("time", "12:00 PM");
      taskMap.set("cost", "0 VND");
      taskMap.set("image", "");

      itemsMap.set(taskId, taskMap);
      columnArray.push([taskId]);
    });

    handleOpenTaskDetails(taskId);
  };

  // Column CRUD triggers
  const handleAddColumn = () => {
    if (!yDoc) return;
    yDoc.transact(() => {
      const orderArray = getSharedColumnOrder(yDoc);
      const metadataMap = getSharedColumnMetadata(yDoc);
      const columnsMap = getSharedColumns(yDoc);

      const nextIndex = orderArray.length + 1;
      const colId = `day_${nextIndex}_` + Math.random().toString(36).substring(2, 6);

      orderArray.push([colId]);
      metadataMap.set(colId, { id: colId, title: `DAY ${nextIndex}: NEW DAY` });
      columnsMap.set(colId, new Y.Array<string>());
    });
  };

  const handleStartEditColumn = (colId: string, currentTitle: string) => {
    setEditingColumnId(colId);
    setEditingColumnTitle(currentTitle);
  };

  const handleSaveColumnTitle = (colId: string) => {
    if (!yDoc || !editingColumnTitle.trim()) return;
    yDoc.transact(() => {
      const metadataMap = getSharedColumnMetadata(yDoc);
      const currentMeta = (metadataMap.get(colId) || {}) as any;
      metadataMap.set(colId, { ...currentMeta, title: editingColumnTitle });
    });
    setEditingColumnId(null);
  };

  const handleDeleteColumn = (colId: string) => {
    if (!yDoc) return;
    if (!window.confirm("Are you sure you want to delete this day and all its activities?")) return;
    yDoc.transact(() => {
      const orderArray = getSharedColumnOrder(yDoc);
      const metadataMap = getSharedColumnMetadata(yDoc);
      const columnsMap = getSharedColumns(yDoc);
      const itemsMap = getSharedItems(yDoc);

      const taskIds = columns[colId] || [];
      taskIds.forEach((tid) => {
        itemsMap.delete(tid);
      });

      const colIndex = orderArray.toArray().indexOf(colId);
      if (colIndex !== -1) {
        orderArray.delete(colIndex);
      }

      metadataMap.delete(colId);
      columnsMap.delete(colId);
    });
  };

  const handleInvitePeer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardDetails?.workspaceId || !inviteEmail.trim()) return;
    try {
      setInviteLoading(true);
      await httpClient.post(`/workspaces/${boardDetails.workspaceId}/invite`, {
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteEmail("");
      setShowInviteModal(false);
      alert("✅ Invitation sent successfully!");
    } catch (err: any) {
      console.error("❌ Failed to invite peer:", err);
      alert(`❌ Failed to invite: ${err.response?.data?.error?.message || err.message}`);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Deduplicate active presence list by userId
  const uniqueCollaborators = useMemo(() => {
    const seen = new Set<string>();
    const list = [];

    if (currentUser) {
      seen.add(currentUser.id);
      list.push({
        userId: currentUser.id,
        name: currentUser.name,
        avatarUrl: currentUser.avatarUrl,
        color: "var(--primary)",
      });
    }

    remoteCursors.forEach((c) => {
      if (!seen.has(c.userId)) {
        seen.add(c.userId);
        list.push({
          userId: c.userId,
          name: c.name,
          avatarUrl: c.avatarUrl,
          color: c.color,
        });
      }
    });

    return list;
  }, [currentUser, remoteCursors]);

  if (loadingMetadata || joiningRoom) {
    return (
      <div className="page-loading">
        <Spinner size="large" />
        <p>Connecting to planner board & synchronizing layout...</p>
      </div>
    );
  }

  if (metadataError || roomError) {
    return (
      <div className="page-loading">
        <div style={{ color: "var(--danger)", fontSize: 16, fontWeight: 600 }}>
          ❌ Connection Error: {metadataError || roomError}
        </div>
        <button className="icon-action-btn" onClick={() => navigate("/")} style={{ marginTop: 16 }}>
          <ArrowLeft size={16} />
          <span>Back to Workspaces</span>
        </button>
      </div>
    );
  }

  return (
    <div className="kanban-container">
      {/* Board Header */}
      <header className="kanban-header">
        <div className="board-info-section">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <button
              onClick={() => navigate("/")}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
              }}
            >
              <ArrowLeft size={18} />
            </button>
            <h2>{boardDetails?.name}</h2>
          </div>
          <p>{boardDetails?.description || "Collaborative co-op trip space"}</p>
        </div>

        {/* Collaborators Active List & Invite Peers shortcut */}
        <div className="board-collaborators" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, color: "var(--success)" }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: "var(--success)", animation: "fadeIn 1.5s infinite" }} />
            <span>LIVE: {uniqueCollaborators.length} ONLINE</span>
          </div>

          <div className="presence-bubbles">
            {uniqueCollaborators.map((c) => (
              <div
                key={c.userId}
                className="presence-bubble"
                style={{ borderColor: c.color }}
                title={c.name}
              >
                {c.avatarUrl ? (
                  <img src={c.avatarUrl} alt={c.name} />
                ) : (
                  <div className="presence-bubble-placeholder" style={{ backgroundColor: c.color }}>
                    {c.name.substring(0, 2)}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            className="icon-action-btn"
            style={{
              borderColor: "var(--primary)",
              color: "#fff",
              background: "linear-gradient(135deg, var(--primary), var(--secondary))",
              boxShadow: "0 0 10px var(--primary-glow)",
            }}
            onClick={() => setShowInviteModal(true)}
          >
            + Invite Peers
          </button>
        </div>
      </header>

      {/* Board Canvas */}
      <div className="board-canvas-area" ref={canvasRef}>
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="board-columns-list">
            {columnOrder.map((colId) => {
              const taskIds = columns[colId] || [];
              const metadata = columnMetadata[colId];
              const columnTitle = metadata?.title || `DAY ${colId.toUpperCase()}`;

              // Dynamic local chronological sort by time
              const itemsMap = getSharedItems(yDoc);
              const sortedTaskIds = [...taskIds].sort((a, b) => {
                const itemA = itemsMap.get(a) as Y.Map<any> | undefined;
                const itemB = itemsMap.get(b) as Y.Map<any> | undefined;
                const timeA = itemA?.get("time");
                const timeB = itemB?.get("time");
                return parseTimeToMinutes(timeA) - parseTimeToMinutes(timeB);
              });

              return (
                <div key={colId} className="kanban-column">
                  <div className="column-header">
                    <div className="column-title" style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, overflow: "hidden" }}>
                      {editingColumnId === colId ? (
                        <input
                          type="text"
                          value={editingColumnTitle}
                          onChange={(e) => setEditingColumnTitle(e.target.value)}
                          onBlur={() => handleSaveColumnTitle(colId)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveColumnTitle(colId);
                          }}
                          autoFocus
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid var(--primary)",
                            borderRadius: 6,
                            color: "#fff",
                            padding: "2px 6px",
                            width: "90%",
                          }}
                        />
                      ) : (
                        <h3
                          onDoubleClick={() => handleStartEditColumn(colId, columnTitle)}
                          style={{ cursor: "pointer", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                          title="Double click to rename"
                        >
                          {columnTitle}
                        </h3>
                      )}
                      <span className="task-count">{taskIds.length}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button
                        className="create-task-inline-btn"
                        onClick={() => handleCreateTask(colId)}
                        title="Add Activity"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        className="create-task-inline-btn"
                        onClick={() => handleDeleteColumn(colId)}
                        title="Delete Day"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <SortableContext
                    items={sortedTaskIds}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="cards-container">
                      {sortedTaskIds.map((taskId) => {
                        const focusingCollaborators = remoteCursors
                          .filter((c) => c.focusedItemId === taskId)
                          .map((c) => ({
                            name: c.name,
                            color: c.color,
                            avatarUrl: c.avatarUrl,
                          }));

                        return (
                          <BoardTaskCard
                            key={taskId}
                            taskId={taskId}
                            yDoc={yDoc}
                            onClick={() => handleOpenTaskDetails(taskId)}
                            focusingCollaborators={focusingCollaborators}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </div>
              );
            })}

            {/* Add Column button */}
            <button
              onClick={handleAddColumn}
              className="add-plan-card"
              style={{
                width: 320,
                height: 52,
                minHeight: 52,
                flexShrink: 0,
                borderStyle: "dashed",
                display: "flex",
                flexDirection: "row",
                fontSize: 13,
                fontWeight: 700,
                gap: 8,
              }}
            >
              <Plus size={16} />
              <span>Add Day / Milestone</span>
            </button>
          </div>
        </DndContext>

        {/* Remote Cursors Overlay */}
        <div className="remote-cursor-layer">
          {remoteCursors
            .filter((c) => c.x !== undefined && c.y !== undefined)
            .map((c) => (
              <div
                key={c.clientId}
                className="remote-cursor"
                style={{
                  left: `${c.x! * 100}%`,
                  top: `${c.y! * 100}%`,
                  color: c.color,
                }}
              >
                <div className="cursor-pointer-dot" />
                <div className="cursor-pointer-flag" style={{ backgroundColor: c.color }}>
                  {c.name}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Task Edit Modal Overlay */}
      {activeTaskId && (
        <TaskDetailModal
          isOpen={true}
          onClose={handleCloseTaskDetails}
          taskId={activeTaskId}
          yDoc={yDoc}
        />
      )}

      {/* Invite Modal Overlay */}
      {showInviteModal && (
        <div className="modal-backdrop" onClick={() => setShowInviteModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2>Invite Peers</h2>
              <button
                onClick={() => setShowInviteModal(false)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Share link */}
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label>Share Board Link</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  readOnly
                  value={window.location.href}
                  style={{ flex: 1, background: "rgba(255,255,255,0.02)" }}
                />
                <button
                  className="icon-action-btn"
                  onClick={handleCopyLink}
                  style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}
                >
                  <Copy size={14} />
                  <span>{copiedLink ? "Copied!" : "Copy"}</span>
                </button>
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border-color)", margin: "16px 0" }} />

            {/* Send invitation email */}
            <form onSubmit={handleInvitePeer}>
              <div className="form-group">
                <label>Invite via Email</label>
                <input
                  type="email"
                  placeholder="friend@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Workspace Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                >
                  <option value="member">Member</option>
                  <option value="admin">Workspace Admin</option>
                </select>
              </div>

              <div className="modal-actions" style={{ marginTop: 24 }}>
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
                  {inviteLoading ? "Sending..." : "Send Invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
