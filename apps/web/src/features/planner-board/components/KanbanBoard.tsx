import React, { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import * as Y from "yjs";
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
  DragOverlay,
  CollisionDetection,
  rectIntersection,
  pointerWithin,
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
  getSharedBoardInfo,
} from "@collab-planner/yjs-utils";
import { httpClient } from "../../../shared/api/http-client.js";
import { BoardTaskCard } from "./BoardTaskCard.js";
import { TaskDetailModal } from "./TaskDetailModal.js";
import { Plus, ArrowLeft, Trash2, X, Copy, MapPin, Menu, Settings, Edit2, CheckCircle2, AlertCircle, Crosshair } from "lucide-react";
import { Spinner } from "../../../shared/ui/spinner/Spinner.js";

interface ColumnCardsContainerProps {
  colId: string;
  children: React.ReactNode;
}

const DEFAULT_DAY_COLUMNS = [
  { id: "day_1", title: "DAY 1: ARRIVE & EXPLORE" },
  { id: "day_2", title: "DAY 2: FOOD & FRIENDS" },
  { id: "day_3", title: "DAY 3: NATURE RUN" },
] as const;

const DEFAULT_TASK_ID = "task_default_dalat_kickoff";

const isDefaultDayColumn = (colId: string, title = ""): boolean => {
  return /^day_\d+/.test(colId) || /^DAY\s+\d+/i.test(title.trim());
};

const ColumnCardsContainer: React.FC<ColumnCardsContainerProps> = ({ colId, children }) => {
  const { setNodeRef } = useDroppable({ id: colId });
  return (
    <div ref={setNodeRef} className="cards-container-whiteboard">
      {children}
    </div>
  );
};


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
        console.error("Failed to fetch plan metadata:", err);
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

    console.log(`Initializing SocketIoYjsProvider for plan: ${planId}`);
    const provider = new SocketIoYjsProvider(planId, yDoc, socket);

    return () => {
      provider.destroy();
    };
  }, [socket, joined, planId, yDoc]);

  // 4. Mutation Lock Guard & Dynamic Columns hook
  const [isDraggingLocal, setIsDraggingLocal] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { columns, columnOrder, columnMetadata } = useYjsColumns(yDoc, isDraggingLocal);

  // Read sidebar toggle state from layout context
  const { isSidebarCollapsed, toggleSidebar } = useOutletContext<{
    isSidebarCollapsed: boolean;
    toggleSidebar: () => void;
  }>();

  // Figma-Style Pan & Zoom
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const spacePressed = useRef(false);

  // Spacebar listeners for panning Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA" && !target.isContentEditable) {
          spacePressed.current = true;
          e.preventDefault();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spacePressed.current = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const isCanvas =
      target.classList.contains("board-canvas-area") ||
      target.classList.contains("whiteboard-viewport") ||
      target.classList.contains("board-columns-list");

    const shouldPan = e.button === 1 || e.button === 2 || spacePressed.current || isCanvas;

    if (shouldPan) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    }
  };

  const handleMouseMovePan = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = 0.08;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const canvasMouseX = (mouseX - pan.x) / zoom;
    const canvasMouseY = (mouseY - pan.y) / zoom;

    let nextZoom = zoom;
    if (e.deltaY < 0) {
      nextZoom = Math.min(2, zoom + zoomFactor);
    } else {
      nextZoom = Math.max(0.4, zoom - zoomFactor);
    }

    const nextPanX = mouseX - canvasMouseX * nextZoom;
    const nextPanY = mouseY - canvasMouseY * nextZoom;

    setZoom(nextZoom);
    setPan({ x: nextPanX, y: nextPanY });
  };

  // Auto-scroll the infinite canvas viewport when dragging near screen edges.
  useEffect(() => {
    if (!activeId) return;

    let animationFrameId: number;
    let currentX = window.innerWidth / 2;
    let currentY = window.innerHeight / 2;

    const handlePointerMove = (e: PointerEvent) => {
      currentX = e.clientX;
      currentY = e.clientY;
    };

    window.addEventListener("pointermove", handlePointerMove);

    const checkEdgeAndPan = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const threshold = 50;
      const baseSpeed = 10;
      let deltaX = 0;
      let deltaY = 0;

      if (currentX > width - threshold) {
        deltaX = -baseSpeed / zoom;
      } else if (currentX < threshold) {
        deltaX = baseSpeed / zoom;
      }

      if (currentY > height - threshold) {
        deltaY = -baseSpeed / zoom;
      } else if (currentY < threshold) {
        deltaY = baseSpeed / zoom;
      }

      if (deltaX !== 0 || deltaY !== 0) {
        setPan((prev) => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY,
        }));
      }

      animationFrameId = requestAnimationFrame(checkEdgeAndPan);
    };

    animationFrameId = requestAnimationFrame(checkEdgeAndPan);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [activeId, zoom]);

  // Scale sortable item movement inside the zoomed board while keeping DragOverlay pointer-locked.
  const customCanvasScaleModifier = useMemo(() => {
    return ({ transform, activeNodeRect }: { transform: any; activeNodeRect: any }) => {
      if (!transform || !activeNodeRect) return transform;
      return {
        ...transform,
        x: transform.x / zoom,
        y: transform.y / zoom,
      };
    };
  }, [zoom]);

  // Restore DragOverlay coordinates to 1:1 speed, since it is rendered outside the scaled wrapper.
  const overlayModifier = useMemo(() => {
    return ({ transform }: { transform: any }) => {
      return {
        ...transform,
        x: transform.x * zoom,
        y: transform.y * zoom,
      };
    };
  }, [zoom]);

  // Normalize collision rect bounds using the inverse transform scale for exact intersection checks.
  const customCollisionDetection = useMemo(() => {
    return (args: any) => {
      const pointerCollisions = pointerWithin(args);
      if (pointerCollisions.length > 0) {
        return pointerCollisions;
      }

      const { active, collisionRect, pointerCoordinates } = args;
      if (!collisionRect || !pointerCoordinates) {
        return rectIntersection(args);
      }

      const draggingRect = active.rect.current.translated;
      if (draggingRect) {
        const width = draggingRect.width;
        const height = draggingRect.height;
        const transformX = (active.transform?.x ?? 0) * zoom;
        const transformY = (active.transform?.y ?? 0) * zoom;

        const correctedRect = {
          width,
          height,
          top: active.rect.current.initial?.top ? active.rect.current.initial.top + transformY : draggingRect.top,
          bottom: active.rect.current.initial?.bottom ? active.rect.current.initial.bottom + transformY : draggingRect.bottom,
          left: active.rect.current.initial?.left ? active.rect.current.initial.left + transformX : draggingRect.left,
          right: active.rect.current.initial?.right ? active.rect.current.initial.right + transformX : draggingRect.right,
        };

        return rectIntersection({
          ...args,
          collisionRect: correctedRect,
        });
      }

      return rectIntersection(args);
    };
  }, [zoom]);

  // Workspace and Board metadata state
  const [workspaceDetails, setWorkspaceDetails] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [showEditBoardModal, setShowEditBoardModal] = useState(false);
  const [tempWorkspaceName, setTempWorkspaceName] = useState("");
  const [tempBoardName, setTempBoardName] = useState("");
  const [tempBoardDesc, setTempBoardDesc] = useState("");
  const [saveDetailsLoading, setSaveDetailsLoading] = useState(false);

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

  // Custom Confirm Dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm,
    });
  };

  // Location and Inline editing states
  const [localLocation, setLocalLocation] = useState("VIETNAM");
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [editingLocationValue, setEditingLocationValue] = useState("");
  const [isEditingPlanName, setIsEditingPlanName] = useState(false);
  const [editingPlanNameValue, setEditingPlanNameValue] = useState("");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editingDescValue, setEditingDescValue] = useState("");

  useEffect(() => {
    if (!yDoc) return;
    const boardInfoMap = getSharedBoardInfo(yDoc);

    const updateStatesFromYjs = () => {
      const name = boardInfoMap.get("name") as string;
      const location = boardInfoMap.get("location") as string;
      const description = boardInfoMap.get("description") as string;

      if (name) {
        setBoardDetails((prev) => {
          if (!prev) return null;
          if (prev.name === name) return prev;
          return { ...prev, name };
        });
      }
      if (location) {
        setLocalLocation(location);
      }
      if (description !== undefined) {
        setBoardDetails((prev) => {
          if (!prev) return null;
          if (prev.description === description) return prev;
          return { ...prev, description };
        });
      }
    };

    // Run initial load
    updateStatesFromYjs();

    // Observe changes
    boardInfoMap.observe(updateStatesFromYjs);

    return () => {
      boardInfoMap.unobserve(updateStatesFromYjs);
    };
  }, [yDoc]);

  const handleSaveLocationInline = () => {
    if (!yDoc) return;
    const boardInfoMap = getSharedBoardInfo(yDoc);
    const val = editingLocationValue.trim() || "VIETNAM";
    yDoc.transact(() => {
      boardInfoMap.set("location", val);
    });
    setLocalLocation(val);
    setIsEditingLocation(false);
  };

  const handleSavePlanNameInline = async () => {
    if (!editingPlanNameValue.trim() || !planId) {
      setIsEditingPlanName(false);
      return;
    }
    try {
      await httpClient.patch(`/plans/${planId}`, {
        name: editingPlanNameValue,
      });
      setBoardDetails((prev) => prev ? { ...prev, name: editingPlanNameValue } : null);

      if (yDoc) {
        const boardInfoMap = getSharedBoardInfo(yDoc);
        yDoc.transact(() => {
          boardInfoMap.set("name", editingPlanNameValue);
        });
      }
    } catch (err: any) {
      console.error("Failed to update plan name:", err);
      showToast("Failed to update board name", "error");
    } finally {
      setIsEditingPlanName(false);
    }
  };

  const handleSaveDescInline = async () => {
    if (!planId) {
      setIsEditingDesc(false);
      return;
    }
    const val = editingDescValue.trim();
    try {
      await httpClient.patch(`/plans/${planId}`, {
        description: val,
      });
      setBoardDetails((prev) => prev ? { ...prev, description: val } : null);

      if (yDoc) {
        const boardInfoMap = getSharedBoardInfo(yDoc);
        yDoc.transact(() => {
          boardInfoMap.set("description", val);
        });
      }
    } catch (err: any) {
      console.error("Failed to update plan description:", err);
      showToast("Failed to update description", "error");
    } finally {
      setIsEditingDesc(false);
    }
  };

  // Fetch workspace details
  useEffect(() => {
    const fetchWorkspaceMetadata = async () => {
      if (!boardDetails?.workspaceId) return;
      try {
        const res = await httpClient.get(`/workspaces/${boardDetails.workspaceId}`);
        const ws = res.data?.data;
        if (ws) {
          setWorkspaceDetails({
            id: ws.id,
            name: ws.name,
          });
        }
      } catch (err) {
        console.error("Failed to fetch workspace details:", err);
      }
    };
    fetchWorkspaceMetadata();
  }, [boardDetails?.workspaceId]);

  const handleOpenEditBoardModal = () => {
    setTempWorkspaceName(workspaceDetails?.name || "");
    setTempBoardName(boardDetails?.name || "");
    setTempBoardDesc(boardDetails?.description || "");
    setShowEditBoardModal(true);
  };

  const handleSaveBoardAndWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempBoardName.trim() || !tempWorkspaceName.trim() || !planId || !boardDetails?.workspaceId) return;

    try {
      setSaveDetailsLoading(true);

      // Update Workspace
      await httpClient.patch(`/workspaces/${boardDetails.workspaceId}`, {
        name: tempWorkspaceName,
      });

      // Update Plan Board
      await httpClient.patch(`/plans/${planId}`, {
        name: tempBoardName,
        description: tempBoardDesc,
      });

      // Update local states
      setBoardDetails((prev) => prev ? {
        ...prev,
        name: tempBoardName,
        description: tempBoardDesc,
      } : null);

      setWorkspaceDetails((prev) => prev ? {
        ...prev,
        name: tempWorkspaceName,
      } : null);

      // Sync name in real-time with other peers
      if (yDoc) {
        const boardInfoMap = getSharedBoardInfo(yDoc);
        yDoc.transact(() => {
          boardInfoMap.set("name", tempBoardName);
        });
      }

      setShowEditBoardModal(false);
    } catch (err: any) {
      console.error("Failed to save board and workspace details:", err);
      showToast("Failed to save details: " + (err.response?.data?.error?.message || err.message), "error");
    } finally {
      setSaveDetailsLoading(false);
    }
  };

  // Column CRUD and Invite States
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnTitle, setEditingColumnTitle] = useState("");

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // 5. Awareness Layer (Tracking is scoped to the zoomed whiteboard viewport ref)
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const { remoteCursors, updateFocusedItem } = useYjsAwareness(
    socket,
    planId,
    currentUser,
    viewportRef // Setting the tracking viewport wrapper enables auto canvas coordinates mapping
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

  const handleDeleteTask = (taskId: string) => {
    if (!yDoc) return;
    showConfirm(
      "Delete Activity",
      "Are you sure you want to delete this activity?",
      () => {
        yDoc.transact(() => {
          const columnsMap = getSharedColumns(yDoc);
          const itemsMap = getSharedItems(yDoc);
          const sourceCol = findColumnOfTaskId(taskId);

          if (sourceCol) {
            const sourceArray = columnsMap.get(sourceCol);
            if (sourceArray) {
              const index = sourceArray.toArray().indexOf(taskId);
              if (index !== -1) {
                sourceArray.delete(index);
              }
            }
          }

          itemsMap.delete(taskId);
        });
      }
    );
  };

  const getActiveCardThemeColor = (): "teal" | "purple" | "rose" => {
    if (!activeId) return "teal";
    const colId = findColumnOfTaskId(activeId);
    if (!colId) return "teal";
    const index = columnOrder.indexOf(colId);
    if (index === -1) return "teal";
    const themes: Array<"teal" | "purple" | "rose"> = ["teal", "purple", "rose"];
    return themes[index % 3];
  };

  const handleDragStart = (event: DragStartEvent) => {
    setIsDraggingLocal(true);
    setActiveId(event.active.id as string);
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
    showConfirm(
      "Delete Day",
      "Are you sure you want to delete this day and all its activities?",
      () => {
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
      }
    );
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
      showToast("Invitation sent successfully!", "success");
    } catch (err: any) {
      console.error("Failed to invite peer:", err);
      showToast("Failed to invite: " + (err.response?.data?.error?.message || err.message), "error");
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
          Connection Error: {metadataError || roomError}
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
      {/* Board Header (Whiteboard styled) */}
      <header className="kanban-header whiteboard">
        <div className="board-info-section">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", color: "#94a3b8", textTransform: "uppercase" }}>
              Workspace: {workspaceDetails?.name || "Loading..."}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            {isSidebarCollapsed && (
              <button
                onClick={toggleSidebar}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  marginRight: 4
                }}
                title="Expand Sidebar"
              >
                <Menu size={18} />
              </button>
            )}
            <button
              onClick={() => navigate("/")}
              style={{
                background: "transparent",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
              }}
            >
              <ArrowLeft size={18} />
            </button>

            {isEditingPlanName ? (
              <input
                type="text"
                value={editingPlanNameValue}
                onChange={(e) => setEditingPlanNameValue(e.target.value)}
                onBlur={handleSavePlanNameInline}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSavePlanNameInline();
                  if (e.key === "Escape") setIsEditingPlanName(false);
                }}
                autoFocus
                style={{
                  fontSize: "24px",
                  fontWeight: "800",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid var(--border-color)",
                  color: "var(--text-main)",
                  outline: "none",
                  padding: "0 4px",
                  marginRight: "8px",
                  maxWidth: "300px"
                }}
              />
            ) : (
              <h2
                onDoubleClick={() => {
                  setEditingPlanNameValue(boardDetails?.name || "");
                  setIsEditingPlanName(true);
                }}
                title="Double click to edit board name"
                style={{ cursor: "pointer" }}
              >
                {boardDetails?.name}
              </h2>
            )}

            {isEditingLocation ? (
              <input
                type="text"
                value={editingLocationValue}
                onChange={(e) => setEditingLocationValue(e.target.value)}
                onBlur={handleSaveLocationInline}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveLocationInline();
                  if (e.key === "Escape") setIsEditingLocation(false);
                }}
                autoFocus
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "20px",
                  color: "#94a3b8",
                  fontFamily: "inherit",
                  fontSize: "12px",
                  fontWeight: 600,
                  width: "120px",
                  outline: "none",
                  padding: "4px 10px",
                  textTransform: "uppercase"
                }}
              />
            ) : (
              <div
                className="location-pill-whiteboard"
                onDoubleClick={() => {
                  setEditingLocationValue(localLocation);
                  setIsEditingLocation(true);
                }}
                title="Double click to edit location"
                style={{ cursor: "pointer" }}
              >
                <MapPin size={12} />
                <span>{localLocation.toUpperCase()}</span>
              </div>
            )}
          </div>
          {isEditingDesc ? (
            <textarea
              value={editingDescValue}
              onChange={(e) => setEditingDescValue(e.target.value)}
              onBlur={handleSaveDescInline}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveDescInline();
                }
                if (e.key === "Escape") setIsEditingDesc(false);
              }}
              autoFocus
              rows={2}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                color: "var(--text-muted)",
                fontFamily: "inherit",
                fontSize: "13px",
                outline: "none",
                padding: "6px 12px",
                width: "100%",
                maxWidth: "600px",
                resize: "vertical"
              }}
            />
          ) : (
            <p
              onDoubleClick={() => {
                setEditingDescValue(boardDetails?.description || "");
                setIsEditingDesc(true);
              }}
              title="Double click to edit description"
              style={{ cursor: "pointer", display: "inline-block" }}
            >
              {boardDetails?.description || "Collaborative co-op trip space"}
            </p>
          )}
        </div>

        {/* Collaborators Active List & Invite Peers shortcut */}
        <div className="board-collaborators" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div className="online-status-whiteboard">
            <span className="status-dot-wrapper">
              <span className="status-dot-ping"></span>
              <span className="status-dot"></span>
            </span>
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
                    {c.name.substring(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            className="icon-action-btn"
            onClick={() => setShowInviteModal(true)}
            style={{ fontWeight: 600, fontSize: 13 }}
          >
            + Invite Peers
          </button>
        </div>
      </header>

      {/* Board Canvas (Figma-style pan/zoom handlers attached) */}
      <div
        className="board-canvas-area whiteboard"
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMovePan}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isPanning ? "grabbing" : spacePressed.current ? "grab" : "default" }}
      >
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          modifiers={[customCanvasScaleModifier]}
          collisionDetection={customCollisionDetection}
        >
          {/* Transforming viewport containing columns & nested cursors layer */}
          <div
            ref={viewportRef}
            className="whiteboard-viewport"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              width: "max-content",
              height: "max-content",
              minWidth: "100%",
              minHeight: "100%",
              display: "flex",
              alignItems: "flex-start",
              position: "relative",
            }}
          >
            <div className="board-columns-list">
              {columnOrder.map((colId, index) => {
                const taskIds = columns[colId] || [];
                const metadata = columnMetadata[colId];
                const columnTitle = metadata?.title || `DAY ${colId.toUpperCase()}`;

                // Cycle color themes: teal, purple, rose
                const themes: Array<"teal" | "purple" | "rose"> = ["teal", "purple", "rose"];
                const themeColor = themes[index % 3];

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
                  <div key={colId} className="kanban-column-whiteboard">
                    {/* Floating Header Card */}
                    <div className="column-header-card">
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, overflow: "hidden" }}>
                        <div className={`day-badge ${themeColor}`}>
                          D{index + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
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
                              className="column-title-input-whiteboard"
                            />
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                              <h3
                                onDoubleClick={() => handleStartEditColumn(colId, columnTitle)}
                                style={{ cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}
                                title="Double click to rename"
                              >
                                {columnTitle}
                              </h3>
                              <button
                                onClick={() => handleStartEditColumn(colId, columnTitle)}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "#94a3b8",
                                  cursor: "pointer",
                                  padding: 2,
                                  display: "flex",
                                  alignItems: "center",
                                }}
                                title="Rename Day"
                              >
                                <Edit2 size={12} />
                              </button>
                            </div>
                          )}
                          <p style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, marginTop: 2 }}>
                            {taskIds.length} {taskIds.length === 1 ? "Activity" : "Activities"}
                          </p>
                        </div>
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
                          style={{ color: "#94a3b8" }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Cards Container with DND droppable registration */}
                    <SortableContext
                      items={sortedTaskIds}
                      strategy={verticalListSortingStrategy}
                    >
                      <ColumnCardsContainer colId={colId}>
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
                              themeColor={themeColor}
                              onDelete={() => handleDeleteTask(taskId)}
                            />
                          );
                        })}
                      </ColumnCardsContainer>
                    </SortableContext>

                    {/* Dashed Column Add Plan Button */}
                    <button
                      className="add-plan-dashed-btn"
                      onClick={() => handleCreateTask(colId)}
                    >
                      <Plus size={16} />
                      <span>ADD PLAN</span>
                    </button>
                  </div>
                );
              })}

              {/* Add Column button */}
              <button
                onClick={handleAddColumn}
                className="add-plan-dashed-btn"
                style={{
                  width: 320,
                  height: 72,
                  minHeight: 72,
                  flexShrink: 0,
                  fontSize: 13,
                  fontWeight: 700,
                  display: "flex",
                  flexDirection: "row",
                  gap: 8,
                  borderStyle: "dashed",
                }}
              >
                <Plus size={16} />
                <span>Add Day / Milestone</span>
              </button>
            </div>

            {/* Remote Cursors Overlay (Inside viewport for proper scaling alignment) */}
            <div className="remote-cursor-layer" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 40 }}>
              {remoteCursors
                .filter((c) => c.x !== undefined && c.y !== undefined)
                .map((c) => (
                  <div
                    key={c.clientId}
                    style={{
                      position: "absolute",
                      left: `${c.x! * 100}%`,
                      top: `${c.y! * 100}%`,
                      zIndex: 50,
                      pointerEvents: "none",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      // Apply counter-scaling so cursor elements stay at constant visual size
                      transform: `scale(${1 / zoom})`,
                      transformOrigin: "0 0",
                      transition: "left 0.15s ease-out, top 0.15s ease-out",
                    }}
                  >
                    <div style={{ position: "relative", display: "inline-flex" }}>
                      <svg
                        width="24" height="24" viewBox="0 0 24 24" fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}
                      >
                        <path d="M5.5 3.21V20.8C5.5 21.6 6.38 22.08 7.04 21.65L10.82 19.16C11.08 18.99 11.4 18.92 11.71 18.97L16.29 19.68C17.06 19.8 17.65 19.06 17.37 18.33L10.37 3.01C10.02 2.23 8.88 2.31 8.65 3.13L5.5 3.21Z" fill={c.color} stroke="white" strokeWidth="1.5" />
                      </svg>
                      <div
                        className="animate-pulse-ring"
                        style={{
                          position: "absolute",
                          top: 4,
                          left: 4,
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          backgroundColor: c.color,
                          zIndex: -1,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        backgroundColor: c.color,
                        marginTop: 4,
                        marginLeft: 12,
                        padding: "2px 6px",
                        borderRadius: 4,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                        fontSize: 9,
                        fontWeight: 700,
                        color: "white",
                        letterSpacing: "0.05em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.name}
                    </div>
                  </div>
                ))}
            </div>

          </div>

          {/* Floating DragOverlay styled preview */}
          {createPortal(
            <DragOverlay dropAnimation={null} modifiers={[overlayModifier]}>
              {activeId ? (
                <div
                  style={{
                    width: '280px',
                    height: 'auto',
                    boxSizing: 'border-box',
                    opacity: 0.9,
                  }}
                >
                  <BoardTaskCard
                    taskId={activeId}
                    yDoc={yDoc}
                    onClick={() => { }}
                    focusingCollaborators={[]}
                    themeColor={getActiveCardThemeColor()}
                    isOverlay
                  />
                </div>
              ) : null}
            </DragOverlay>,
            document.body
          )}
        </DndContext>

        {/* Floating Canvas Zoom/Pan Controls */}
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: 24,
            display: "flex",
            gap: 8,
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            padding: 6,
            borderRadius: 12,
            boxShadow: "var(--glass-shadow)",
            backdropFilter: "blur(10px)",
            zIndex: 30,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            className="canvas-control-btn"
            onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
            title="Zoom In"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              width: 28,
              height: 28,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s"
            }}
          >
            +
          </button>
          <div style={{ alignSelf: "center", fontSize: 11, fontWeight: 700, minWidth: 40, textAlign: "center", color: "var(--text-muted)" }}>
            {Math.round(zoom * 100)}%
          </div>
          <button
            className="canvas-control-btn"
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
            title="Zoom Out"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              width: 28,
              height: 28,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s"
            }}
          >
            -
          </button>
          <div style={{ width: 1, backgroundColor: "var(--border-color)", margin: "4px 2px" }} />
          <button
            className="canvas-control-btn"
            onClick={() => {
              setPan({ x: 0, y: 0 });
              setZoom(1);
            }}
            title="Focus on Day 1"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              width: 28,
              height: 28,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s"
            }}
          >
            <Crosshair size={14} />
          </button>
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

      {/* Edit Board & Workspace Details Modal */}
      {showEditBoardModal && (
        <div className="modal-backdrop" onClick={() => setShowEditBoardModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-main)" }}>Edit Board & Workspace</h2>
              <button
                onClick={() => setShowEditBoardModal(false)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveBoardAndWorkspace}>
              <div style={{ padding: "0 0 16px 0", borderBottom: "1px solid var(--border-color)", marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", marginBottom: 12 }}>WORKSPACE</h3>
                <div className="form-group">
                  <label>Workspace Name</label>
                  <input
                    type="text"
                    value={tempWorkspaceName}
                    onChange={(e) => setTempWorkspaceName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", marginBottom: 12 }}>PLAN BOARD</h3>
                <div className="form-group">
                  <label>Board Name</label>
                  <input
                    type="text"
                    value={tempBoardName}
                    onChange={(e) => setTempBoardName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={tempBoardDesc}
                    onChange={(e) => setTempBoardDesc(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: 24 }}>
                <button
                  type="button"
                  className="modal-btn btn-secondary"
                  onClick={() => setShowEditBoardModal(false)}
                  disabled={saveDetailsLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-btn btn-primary"
                  disabled={saveDetailsLoading || !tempBoardName.trim() || !tempWorkspaceName.trim()}
                >
                  {saveDetailsLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDialog && confirmDialog.isOpen && (
        <div className="modal-backdrop" onClick={() => setConfirmDialog(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "var(--text-main)" }}>{confirmDialog.title}</h2>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.5 }}>
              {confirmDialog.message}
            </p>
            <div className="modal-actions" style={{ marginTop: 0 }}>
              <button
                className="modal-btn btn-secondary"
                onClick={() => setConfirmDialog(null)}
              >
                Cancel
              </button>
              <button
                className="modal-btn btn-primary"
                style={{ backgroundColor: "#ef4444", color: "#fff" }}
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
              >
                Delete
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
