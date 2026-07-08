import React, { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import * as Y from "yjs";
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
  DragOverlay,
  CollisionDetection,
  rectIntersection,
  pointerWithin,
  MeasuringStrategy,
  useDraggable,
  DragMoveEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useAuth } from "../../../app/providers/AuthProvider.js";
import { useJoinPlannerRoom } from "../../realtime/hooks/useJoinPlannerRoom.js";
import { SocketIoYjsProvider } from "../../collaborative-editor/yjs/socket-io-yjs-provider.js";
import { useYjsColumns } from "../../collaborative-editor/hooks/useYjsDocument.js";
import { useYjsAwareness } from "../../collaborative-editor/hooks/useYjsAwareness.js";
import { useDrawingPaths } from "../../collaborative-editor/hooks/useDrawingPaths.js";
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
import { Plus, ArrowLeft, Trash2, X, Copy, MapPin, Menu, Settings, Edit2, CheckCircle2, AlertCircle, Crosshair, MousePointer, Eraser } from "lucide-react";
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

interface WhiteboardColumnProps {
  colId: string;
  index: number;
  taskIds: string[];
  columnTitle: string;
  themeColor: "teal" | "purple" | "rose";
  zoom: number;
  localColPositions: Record<string, { x: number; y: number }>;
  yDoc: Y.Doc | null | undefined;
  activeId: string | null;
  editingColumnId: string | null;
  editingColumnTitle: string;
  setEditingColumnTitle: (val: string) => void;
  handleSaveColumnTitle: (colId: string) => void;
  handleStartEditColumn: (colId: string, title: string) => void;
  handleCreateTask: (colId: string) => void;
  handleDeleteColumn: (colId: string) => void;
  handleOpenTaskDetails: (taskId: string) => void;
  handleDeleteTask: (taskId: string) => void;
  remoteCursors: any[];
}

const WhiteboardColumn: React.FC<WhiteboardColumnProps> = ({
  colId,
  index,
  taskIds,
  columnTitle,
  themeColor,
  zoom,
  localColPositions,
  yDoc,
  editingColumnId,
  editingColumnTitle,
  setEditingColumnTitle,
  handleSaveColumnTitle,
  handleStartEditColumn,
  handleCreateTask,
  handleDeleteColumn,
  handleOpenTaskDetails,
  handleDeleteTask,
  remoteCursors,
}) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `col-header:${colId}`,
    data: {
      type: "COLUMN",
      colId,
    },
  });

  const colPos = localColPositions[colId] || { x: index * 360, y: 0 };
  const tx = transform ? transform.x / zoom : 0;
  const ty = transform ? transform.y / zoom : 0;

  // Cycle sorted items logic
  const itemsMap = yDoc ? getSharedItems(yDoc) : null;
  const sortedTaskIds = useMemo(() => {
    return [...taskIds].sort((a, b) => {
      if (!itemsMap) return 0;
      const itemA = itemsMap.get(a) as Y.Map<any> | undefined;
      const itemB = itemsMap.get(b) as Y.Map<any> | undefined;
      const timeA = itemA?.get("time");
      const timeB = itemB?.get("time");
      return parseTimeToMinutes(timeA) - parseTimeToMinutes(timeB);
    });
  }, [taskIds, itemsMap]);

  return (
    <div
      ref={setNodeRef}
      className="kanban-column-whiteboard"
      style={{
        position: "absolute",
        left: `${colPos.x}px`,
        top: `${colPos.y}px`,
        transform: transform ? `translate3d(${tx}px, ${ty}px, 0)` : undefined,
        width: "316px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        zIndex: transform ? 30 : 1,
      }}
    >
      {/* Column Header */}
      <div
        className="column-header-card"
        style={{ cursor: "grab" }}
        {...attributes}
        {...listeners}
      >
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
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleStartEditColumn(colId, columnTitle);
                  }}
                  style={{ cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}
                  title="Double click to rename"
                >
                  {columnTitle}
                </h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartEditColumn(colId, columnTitle);
                  }}
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
        <div style={{ display: "flex", alignItems: "center", gap: 4 }} onClick={(e) => e.stopPropagation()}>
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
                yDoc={yDoc || undefined}
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

// Force dnd-kit to re-measure droppable container bounding client rects on every drag frame.
const dndMeasuringConfig = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
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
  const [provider, setProvider] = useState<SocketIoYjsProvider | null>(null);

  useEffect(() => {
    if (!socket || !joined || !planId) return;

    console.log(`Initializing SocketIoYjsProvider for plan: ${planId}`);
    const prov = new SocketIoYjsProvider(planId, yDoc, socket);
    setProvider(prov);

    return () => {
      prov.destroy();
      setProvider(null);
    };
  }, [socket, joined, planId, yDoc]);

  // 4. Mutation Lock Guard & Dynamic Columns hook
  const [isDraggingLocal, setIsDraggingLocal] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { columns, columnOrder, columnMetadata } = useYjsColumns(yDoc, isDraggingLocal);

  // Read sidebar toggle state from layout context
  const { isSidebarCollapsed, toggleSidebar, isMobile, setIsMobileDrawerOpen } = useOutletContext<{
    isSidebarCollapsed: boolean;
    toggleSidebar: () => void;
    isMobile: boolean;
    setIsMobileDrawerOpen: (val: boolean) => void;
  }>();

  // Figma-Style Pan & Zoom
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const spacePressed = useRef(false);

  // Collaborative Drawing States
  const [activeTool, setActiveTool] = useState<"select" | "brush" | "eraser">("select");
  const [brushColor, setBrushColor] = useState("#38bdf8");
  const [brushSize, setBrushSize] = useState(6);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const minimapDragStart = useRef<{ x: number; y: number; pan: { x: number; y: number } } | null>(null);

  const { startDrawing, drawMove, endDrawing } = useDrawingPaths(
    yDoc,
    drawingCanvasRef,
    activeTool,
    brushColor,
    brushSize
  );

  // Shared Yjs Map positions for day columns
  const [colPositions, setColPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [localColPositions, setLocalColPositions] = useState<Record<string, { x: number; y: number }>>({});

  // Synchronize columnPositions from Yjs Map observer
  useEffect(() => {
    if (!yDoc) return;
    const colPosMap = yDoc.getMap("columnPositions");

    const updatePositions = () => {
      const current = colPosMap.toJSON() as Record<string, { x: number; y: number }>;
      setColPositions(current);
      // Only reset local positions to Yjs coordinates if user is not actively dragging columns locally
      setLocalColPositions((prev) => {
        const next = { ...prev };
        Object.keys(current).forEach((colId) => {
          if (activeId !== `col-header:${colId}`) {
            next[colId] = current[colId];
          }
        });
        return next;
      });
    };

    updatePositions();
    colPosMap.observe(updatePositions);
    return () => {
      colPosMap.unobserve(updatePositions);
    };
  }, [yDoc, activeId]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === "select") return;
    if (e.buttons !== 1) return;
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    startDrawing(x, y);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === "select") return;
    if (e.buttons !== 1) return;
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    drawMove(x, y);
  };

  const handleCanvasMouseUp = () => {
    endDrawing();
  };

  // Touch viewport controls refs
  const touchStartDist = useRef<number | null>(null);
  const touchStartZoom = useRef<number>(1);
  const touchStartPan = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchStartMid = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const target = touch.target as HTMLElement;

      // Skip background panning if touching columns or cards
      if (
        target.closest(".kanban-column-whiteboard") ||
        target.closest(".column-header-card") ||
        target.closest(".task-card-wrapper") ||
        target.closest(".add-plan-dashed-btn")
      ) {
        return;
      }

      setIsPanning(true);
      setPanStart({
        x: touch.clientX - pan.x,
        y: touch.clientY - pan.y,
      });
    } else if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      touchStartDist.current = dist;
      touchStartZoom.current = zoom;
      touchStartPan.current = pan;

      const midX = (touch1.clientX + touch2.clientX) / 2;
      const midY = (touch1.clientY + touch2.clientY) / 2;
      touchStartMid.current = { x: midX, y: midY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1 && isPanning) {
      const touch = e.touches[0];
      setPan({
        x: touch.clientX - panStart.x,
        y: touch.clientY - panStart.y,
      });
    } else if (e.touches.length === 2 && touchStartDist.current !== null) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      const scaleChange = dist / touchStartDist.current;
      const nextZoom = Math.min(Math.max(touchStartZoom.current * scaleChange, 0.15), 3);

      const mid = touchStartMid.current;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const pivotX = mid.x - rect.left;
        const pivotY = mid.y - rect.top;

        const factor = nextZoom / touchStartZoom.current;
        setZoom(nextZoom);
        setPan({
          x: mid.x - pivotX * factor,
          y: mid.y - pivotY * factor,
        });
      }
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
    touchStartDist.current = null;
  };

  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (minimapDragStart.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const canvasX = clickX / 0.036;
    const canvasY = clickY / 0.036;

    setPan({
      x: window.innerWidth / 2 - canvasX * zoom,
      y: window.innerHeight / 2 - canvasY * zoom,
    });
  };

  const handleMinimapPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    minimapDragStart.current = {
      x: e.clientX,
      y: e.clientY,
      pan: { ...pan },
    };
  };

  const handleMinimapPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!minimapDragStart.current) return;
    e.stopPropagation();

    const dx = e.clientX - minimapDragStart.current.x;
    const dy = e.clientY - minimapDragStart.current.y;

    setPan({
      x: minimapDragStart.current.pan.x - (dx / 0.036) * zoom,
      y: minimapDragStart.current.pan.y - (dy / 0.036) * zoom,
    });
  };

  const handleMinimapPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (minimapDragStart.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      minimapDragStart.current = null;
    }
  };

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

  // Track the client's mouse coordinates globally to map absolute dragProgress points
  const lastMousePos = useRef({ clientX: 0, clientY: 0 });
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      lastMousePos.current = { clientX: e.clientX, clientY: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
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
    if (!isDraggingLocal) return;

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
        window.dispatchEvent(new Event("scroll"));
      }

      animationFrameId = requestAnimationFrame(checkEdgeAndPan);
    };

    animationFrameId = requestAnimationFrame(checkEdgeAndPan);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDraggingLocal, zoom]);

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
  const { remoteCursors, updateFocusedItem, updateDraggingItem, updateDragProgress } = useYjsAwareness(
    socket,
    planId,
    currentUser,
    canvasRef, // Use unscaled board canvas for precise geometric tracking
    pan,
    zoom,
    provider
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
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
    const { active } = event;
    const type = active.data.current?.type;
    setIsDraggingLocal(true);
    setActiveId(active.id as string);

    if (type === "COLUMN") {
      const colId = active.data.current?.colId;
      if (colId) {
        updateDraggingItem(colId);
      }
    } else {
      updateDraggingItem(active.id as string);
    }
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const { active, delta } = event;
    const type = active.data.current?.type;

    if (type === "COLUMN") {
      const colId = active.data.current?.colId;
      if (!colId) return;
      const startPos = colPositions[colId] || {
        x: columnOrder.indexOf(colId) * 360,
        y: 0,
      };
      
      const currentX = startPos.x + delta.x / zoom;
      const currentY = startPos.y + delta.y / zoom;

      // Update local React UI position overrides smoothly at 60fps
      setLocalColPositions((prev) => ({
        ...prev,
        [colId]: {
          x: currentX,
          y: currentY,
        },
      }));

      // Broadcast drag progress through Yjs awareness simulation
      updateDragProgress({
        itemId: colId,
        type: "COLUMN",
        x: currentX,
        y: currentY,
      });
    } else {
      // For a TASK card, we broadcast the mouse pointer position
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        // Calculate pointer coordinates inside canvas
        const normalizedX = (lastMousePos.current.clientX - rect.left - pan.x) / zoom;
        const normalizedY = (lastMousePos.current.clientY - rect.top - pan.y) / zoom;

        updateDragProgress({
          itemId: active.id as string,
          type: "TASK",
          x: normalizedX - 140, // center ghost card slightly relative to mouse cursor
          y: normalizedY - 30,
        });
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setIsDraggingLocal(false);
    setActiveId(null);
    updateDraggingItem(undefined);
    updateDragProgress(undefined); // Clear drag progress from awareness
    const { active, delta, over } = event;

    if (active.data.current?.type === "COLUMN") {
      const colId = active.data.current?.colId;
      if (!colId) return;
      const startPos = colPositions[colId] || {
        x: columnOrder.indexOf(colId) * 360,
        y: 0,
      };
      
      const finalX = startPos.x + delta.x / zoom;
      const finalY = startPos.y + delta.y / zoom;
      
      // Update local state immediately so there's zero jump/flicker
      setLocalColPositions((prev) => ({
        ...prev,
        [colId]: { x: finalX, y: finalY },
      }));
      
      if (yDoc) {
        const colPosMap = yDoc.getMap("columnPositions");
        colPosMap.set(colId, { x: finalX, y: finalY });
      }
      return;
    }

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
    if (sourceIndex === -1) return;

    let destIndex = 0;
    if (columnOrder.includes(overId)) {
      destIndex = columns[destCol].length;
    } else {
      const idx = columns[destCol].indexOf(overId);
      destIndex = idx === -1 ? columns[destCol].length : idx;
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

  const handleDragCancel = () => {
    setIsDraggingLocal(false);
    setActiveId(null);
    updateDraggingItem(undefined);
    updateDragProgress(undefined); // Clear drag progress from awareness
    setLocalColPositions({ ...colPositions });
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
            {(isSidebarCollapsed || isMobile) && (
              <button
                onClick={() => {
                  if (isMobile) {
                    setIsMobileDrawerOpen(true);
                  } else {
                    toggleSidebar();
                  }
                }}
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
                title={isMobile ? "Open Navigation" : "Expand Sidebar"}
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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          cursor: isPanning ? "grabbing" : spacePressed.current ? "grab" : "default",
          touchAction: "none",
        }}
      >
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          modifiers={[customCanvasScaleModifier]}
          collisionDetection={customCollisionDetection}
          measuring={dndMeasuringConfig}
        >
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
            {/* HTML5 drawing canvas aligned with the infinite canvas bounds */}
            <canvas
              ref={drawingCanvasRef}
              width={20000}
              height={20000}
              style={{
                position: "absolute",
                top: "-10000px",
                left: "-10000px",
                width: "20000px",
                height: "20000px",
                background: "transparent",
                backgroundColor: "transparent",
                zIndex: activeTool !== "select" ? 25 : -1,
                pointerEvents: activeTool !== "select" ? "auto" : "none",
                cursor: activeTool === "brush" ? "crosshair" : activeTool === "eraser" ? "cell" : "default",
              }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
            />

            <div className="board-columns-list">
              {columnOrder.map((colId, index) => {
                const taskIds = columns[colId] || [];
                const metadata = columnMetadata[colId];
                const columnTitle = metadata?.title || `DAY ${colId.toUpperCase()}`;

                const themes: Array<"teal" | "purple" | "rose"> = ["teal", "purple", "rose"];
                const themeColor = themes[index % 3];

                return (
                  <WhiteboardColumn
                    key={colId}
                    colId={colId}
                    index={index}
                    taskIds={taskIds}
                    columnTitle={columnTitle}
                    themeColor={themeColor}
                    zoom={zoom}
                    localColPositions={localColPositions}
                    yDoc={yDoc}
                    activeId={activeId}
                    editingColumnId={editingColumnId}
                    editingColumnTitle={editingColumnTitle}
                    setEditingColumnTitle={setEditingColumnTitle}
                    handleSaveColumnTitle={handleSaveColumnTitle}
                    handleStartEditColumn={handleStartEditColumn}
                    handleCreateTask={handleCreateTask}
                    handleDeleteColumn={handleDeleteColumn}
                    handleOpenTaskDetails={handleOpenTaskDetails}
                    handleDeleteTask={handleDeleteTask}
                    remoteCursors={remoteCursors}
                  />
                );
              })}

              {/* Add Column button */}
              {(() => {
                const lastColX = columnOrder.reduce((maxX, colId, idx) => {
                  const pos = localColPositions[colId] || { x: idx * 360, y: 0 };
                  return Math.max(maxX, pos.x);
                }, -360);
                const addBtnX = lastColX + 360;

                return (
                  <button
                    onClick={handleAddColumn}
                    className="add-plan-dashed-btn"
                    style={{
                      position: "absolute",
                      left: `${addBtnX}px`,
                      top: "0px",
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
                );
              })()}
            </div>

            

            {/* Remote Dragging Ghosts Overlay (Floating dashed bounding box previews) */}
            {remoteCursors
              .filter((c) => c.dragProgress !== undefined)
              .map((c) => {
                const dp = c.dragProgress!;
                if (dp.type === "COLUMN") {
                  return (
                    <div
                      key={`ghost-col-${c.clientId}`}
                      style={{
                        position: "absolute",
                        left: `${dp.x}px`,
                        top: `${dp.y}px`,
                        width: "316px",
                        height: "600px",
                        backgroundColor: "rgba(99, 102, 241, 0.04)",
                        border: `2px dashed ${c.color}`,
                        borderRadius: "16px",
                        pointerEvents: "none",
                        zIndex: 35,
                        padding: "16px",
                        boxSizing: "border-box",
                        display: "flex",
                        flexDirection: "column",
                        transition: "left 0.1s ease-out, top 0.1s ease-out",
                      }}
                    >
                      <div style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        color: c.color,
                        backgroundColor: "rgba(15, 23, 42, 0.8)",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        alignSelf: "flex-start",
                        border: `1px solid ${c.color}`,
                      }}>
                        {c.name} is moving column...
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div
                      key={`ghost-task-${c.clientId}`}
                      style={{
                        position: "absolute",
                        left: `${dp.x}px`,
                        top: `${dp.y}px`,
                        width: "280px",
                        height: "120px",
                        backgroundColor: "rgba(99, 102, 241, 0.08)",
                        border: `2px dashed ${c.color}`,
                        borderRadius: "12px",
                        pointerEvents: "none",
                        zIndex: 35,
                        padding: "12px",
                        boxSizing: "border-box",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        transition: "left 0.1s ease-out, top 0.1s ease-out",
                      }}
                    >
                      <div style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        color: c.color,
                        backgroundColor: "rgba(15, 23, 42, 0.8)",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        alignSelf: "center",
                        border: `1px solid ${c.color}`,
                        textAlign: "center"
                      }}>
                        {c.name} is dragging item...
                      </div>
                    </div>
                  );
                }
              })}
          </div>

          {/* Remote Cursors Overlay (Outside viewport to prevent double-scaling multiplication issues) */}
          {(() => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return null;
            return (
              <div className="remote-cursor-layer" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 40 }}>
                {remoteCursors
                  .filter((c) => c.x !== undefined && c.y !== undefined && !c.draggingItemId)
                  .map((c) => (
                    <div
                      key={c.clientId}
                      style={{
                        position: "absolute",
                        left: `${c.x! * rect.width + rect.left}px`,
                        top: `${c.y! * rect.height + rect.top}px`,
                        zIndex: 50,
                        pointerEvents: "none",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
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
            );
          })()}

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

        {/* Floating Drawing Toolbar */}
        <div
          className="hidden md:flex"
          style={{
            display: "flex",
            flexDirection: "row",
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 60,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 16,
            padding: "8px 16px",
            alignItems: "center",
            gap: 16,
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Pointer Selector */}
          <button
            onClick={() => setActiveTool("select")}
            style={{
              background: activeTool === "select" ? "rgba(255, 255, 255, 0.12)" : "transparent",
              border: "none",
              borderRadius: 8,
              padding: 8,
              color: activeTool === "select" ? "#38bdf8" : "#94a3b8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
            }}
            title="Select Tool"
          >
            <MousePointer size={18} />
          </button>

          {/* Brush Tool */}
          <button
            onClick={() => setActiveTool("brush")}
            style={{
              background: activeTool === "brush" ? "rgba(255, 255, 255, 0.12)" : "transparent",
              border: "none",
              borderRadius: 8,
              padding: 8,
              color: activeTool === "brush" ? "#38bdf8" : "#94a3b8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
            }}
            title="Brush Tool"
          >
            <Edit2 size={18} />
          </button>

          {/* Eraser Tool */}
          <button
            onClick={() => setActiveTool("eraser")}
            style={{
              background: activeTool === "eraser" ? "rgba(255, 255, 255, 0.12)" : "transparent",
              border: "none",
              borderRadius: 8,
              padding: 8,
              color: activeTool === "eraser" ? "#38bdf8" : "#94a3b8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
            }}
            title="Eraser Tool"
          >
            <Eraser size={18} />
          </button>

          {/* Color Picker Swatches */}
          {activeTool === "brush" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, borderLeft: "1px solid rgba(255, 255, 255, 0.1)", paddingLeft: 16 }}>
              {["#38bdf8", "#f43f5e", "#10b981", "#fbbf24", "#a855f7"].map((color) => (
                <button
                  key={color}
                  onClick={() => setBrushColor(color)}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    backgroundColor: color,
                    border: brushColor === color ? "2px solid white" : "none",
                    cursor: "pointer",
                    padding: 0,
                    transform: brushColor === color ? "scale(1.15)" : "none",
                    transition: "all 0.15s",
                  }}
                />
              ))}
            </div>
          )}

          {/* Brush Size Slider */}
          {activeTool === "brush" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, borderLeft: "1px solid rgba(255, 255, 255, 0.1)", paddingLeft: 16 }}>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>Size:</span>
              <input
                type="range"
                min={2}
                max={24}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                style={{
                  width: 72,
                  accentColor: "#38bdf8",
                  cursor: "pointer",
                }}
              />
              <span style={{ fontSize: 11, color: "#94a3b8", width: 14 }}>{brushSize}</span>
            </div>
          )}
        </div>

        {/* Floating Whiteboard Minimap Container */}
        <div
          className="hidden md:flex"
          style={{
            position: "absolute",
            bottom: 80,
            left: 24,
            width: 180,
            height: 108,
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            borderRadius: 12,
            boxShadow: "var(--glass-shadow)",
            backdropFilter: "blur(10px)",
            zIndex: 30,
            overflow: "hidden",
            cursor: "pointer",
            pointerEvents: "auto",
          }}
          onClick={handleMinimapClick}
        >
          <div style={{ position: "relative", width: "100%", height: "100%", pointerEvents: "none" }}>
            {columnOrder.map((colId, idx) => {
              const pos = localColPositions[colId] || { x: idx * 360, y: 0 };
              return (
                <div
                  key={`mini-col-${colId}`}
                  style={{
                    position: "absolute",
                    left: `${pos.x * 0.036}px`,
                    top: `${pos.y * 0.036}px`,
                    width: `${316 * 0.036}px`,
                    height: `${600 * 0.036}px`,
                    backgroundColor: "rgba(99, 102, 241, 0.2)",
                    border: "1px solid rgba(99, 102, 241, 0.4)",
                    borderRadius: 2,
                  }}
                />
              );
            })}

            {(() => {
              const visibleLeft = (-pan.x / zoom) * 0.036;
              const visibleTop = (-pan.y / zoom) * 0.036;
              const visibleWidth = (window.innerWidth / zoom) * 0.036;
              const visibleHeight = (window.innerHeight / zoom) * 0.036;

              return (
                <div
                  style={{
                    position: "absolute",
                    left: `${visibleLeft}px`,
                    top: `${visibleTop}px`,
                    width: `${visibleWidth}px`,
                    height: `${visibleHeight}px`,
                    border: "1.5px solid #38bdf8",
                    backgroundColor: "rgba(56, 189, 248, 0.08)",
                    borderRadius: 2,
                    cursor: "grab",
                    pointerEvents: "auto",
                  }}
                  onPointerDown={handleMinimapPointerDown}
                  onPointerMove={handleMinimapPointerMove}
                  onPointerUp={handleMinimapPointerUp}
                />
              );
            })()}
          </div>
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
