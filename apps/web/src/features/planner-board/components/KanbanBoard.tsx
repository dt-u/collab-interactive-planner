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
import { getSharedColumns, getSharedItems } from "@collab-planner/yjs-utils";
import { httpClient } from "../../../shared/api/http-client.js";
import { BoardTaskCard } from "./BoardTaskCard.js";
import { TaskDetailModal } from "./TaskDetailModal.js";
import { Plus, User, ArrowLeft, Loader2 } from "lucide-react";
import { Spinner } from "../../../shared/ui/spinner/Spinner.js";

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

    // Initialize columns layout arrays in Yjs if they do not exist
    yDoc.transact(() => {
      const columnsMap = getSharedColumns(yDoc);
      if (!columnsMap.has("todo")) columnsMap.set("todo", new Y.Array<string>());
      if (!columnsMap.has("in_progress")) columnsMap.set("in_progress", new Y.Array<string>());
      if (!columnsMap.has("done")) columnsMap.set("done", new Y.Array<string>());
    });

    return () => {
      provider.destroy();
    };
  }, [socket, joined, planId, yDoc]);

  // 4. Mutation Lock Guard & Columns hook
  const [isDraggingLocal, setIsDraggingLocal] = useState(false);
  const columns = useYjsColumns(yDoc, isDraggingLocal);

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
        distance: 8, // enables dragging only after 8px displacement, letting clicks trigger properly
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

    if (!["todo", "in_progress", "done"].includes(destCol)) {
      destCol = findColumnOfTaskId(overId) || "";
    }

    if (!sourceCol || !destCol) return;

    const columnsMap = getSharedColumns(yDoc);
    const sourceArray = columnsMap.get(sourceCol);
    const destArray = columnsMap.get(destCol);

    if (!sourceArray || !destArray) return;

    const sourceIndex = columns[sourceCol].indexOf(activeId);
    let destIndex = 0;

    if (["todo", "in_progress", "done"].includes(overId)) {
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

  // 8. Create Task Action
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
      taskMap.set("title", "New Task");
      taskMap.set("description", "");
      taskMap.set("status", colId);
      taskMap.set("assignees", []);

      itemsMap.set(taskId, taskMap);
      columnArray.push([taskId]);
    });

    // Automatically open detail modal for the new task
    handleOpenTaskDetails(taskId);
  };

  // Deduplicate active presence list by userId
  const uniqueCollaborators = useMemo(() => {
    const seen = new Set<string>();
    const list = [];
    
    // Add current user first
    if (currentUser) {
      seen.add(currentUser.id);
      list.push({
        userId: currentUser.id,
        name: currentUser.name,
        avatarUrl: currentUser.avatarUrl,
        color: "var(--primary)",
      });
    }

    // Add remote cursors
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
          <p>{boardDetails?.description || "Collaborative planner space"}</p>
        </div>

        {/* Collaborators Active List */}
        <div className="board-collaborators">
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
                  <div className="presence-bubble-placeholder">
                    {c.name.substring(0, 2)}
                  </div>
                )}
              </div>
            ))}
          </div>
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
            {(["todo", "in_progress", "done"] as const).map((colId) => {
              const taskIds = columns[colId] || [];
              const columnTitle =
                colId === "todo"
                  ? "To Do"
                  : colId === "in_progress"
                  ? "In Progress"
                  : "Done";

              return (
                <div key={colId} className="kanban-column">
                  <div className="column-header">
                    <div className="column-title">
                      <h3>{columnTitle}</h3>
                      <span className="task-count">{taskIds.length}</span>
                    </div>
                    <button
                      className="create-task-inline-btn"
                      onClick={() => handleCreateTask(colId)}
                      title="Add Task"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  <SortableContext
                    items={taskIds}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="cards-container">
                      {taskIds.map((taskId) => {
                        // Gather list of remote users focusing on this card
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
    </div>
  );
};
