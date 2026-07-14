import React, { useEffect, useState } from "react";
import * as Y from "yjs";
import { useParams } from "react-router-dom";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useYjsDocument } from "../../collaborative-editor/hooks/useYjsDocument.js";
import { Clock, MessageSquare, Trash2 } from "lucide-react";
import { httpClient } from "../../../shared/api/http-client.js";
import { useAuth } from "../../../app/providers/AuthProvider.js";


interface BoardTaskCardProps {
  taskId: string;
  yDoc: Y.Doc | undefined;
  onClick: () => void;
  focusingCollaborators: Array<{
    name: string;
    color: string;
    avatarUrl?: string;
  }>;
  themeColor?: "teal" | "purple" | "rose";
  isOverlay?: boolean;
  onDelete?: () => void;
}

export const BoardTaskCard: React.FC<BoardTaskCardProps> = ({
  taskId,
  yDoc,
  onClick,
  focusingCollaborators,
  themeColor = "teal",
  isOverlay = false,
  onDelete,
}) => {
  const { planId } = useParams<{ planId: string }>();
  const { user: currentUser } = useAuth();
  const { task } = useYjsDocument(yDoc, taskId);
  const [fallbackImage, setFallbackImage] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!task || !currentUser) return;

    const readIdsRaw = localStorage.getItem(`read_comments_ids_${taskId}`);
    const readIds: string[] = readIdsRaw ? JSON.parse(readIdsRaw) : [];

    let metadata: Array<{ id: string; authorId: string }> = [];
    if (task.commentMetadata) {
      try {
        metadata = JSON.parse(task.commentMetadata);
      } catch (e) {
        console.error("Failed to parse task commentMetadata:", e);
      }
    }

    // Filter out comments posted by the current user
    const otherComments = metadata.filter((c) => c.authorId !== currentUser.id);

    // Count comments not present in readIds
    const unread = otherComments.filter((c) => !readIds.includes(c.id)).length;
    setUnreadCount(unread);
  }, [task, task?.commentMetadata, taskId, currentUser]);

  // Fetch attachments to use as cover fallback if task.coverImage is empty
  useEffect(() => {
    const fetchAttachmentsFallback = async () => {
      if (!task || task.coverImage) return;
      try {
        const res = await httpClient.get(`/items/${taskId}/media`, { params: { planId } });
        const mediaList = res.data?.data || [];
        const firstImage = mediaList.find((m: any) => 
          m.mimeType?.startsWith("image/") || 
          /\.(jpg|jpeg|png|gif|webp)$/i.test(m.fileName)
        );
        if (firstImage) {
          setFallbackImage(firstImage.fileUrl);
        }
      } catch (err) {
        // Silent catch to prevent console pollution on empty states
      }
    };

    fetchAttachmentsFallback();
  }, [taskId, task?.coverImage, planId]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: taskId, disabled: isOverlay });

  const isFocusedByRemote = focusingCollaborators.length > 0;
  const focusColor = isFocusedByRemote ? focusingCollaborators[0].color : undefined;

  const style = {
    transform: isOverlay ? undefined : CSS.Transform.toString(transform),
    transition: isDragging || isOverlay ? "none" : transition,
    opacity: isDragging && !isOverlay ? 0.05 : 1,
    border: focusColor ? `2px solid ${focusColor}` : undefined,
    boxShadow: focusColor ? `0 0 15px ${focusColor}` : undefined,
  };

  if (!task) return null;

  const coverSrc = task.coverImage || fallbackImage;

  // Inline color mappings matching the day badge themes
  const accentColorMap = {
    teal: "#2dd4bf",
    purple: "#c084fc",
    rose: "#f43f5e",
  };

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      className={`whiteboard-task-card ${isFocusedByRemote ? "card-focused-remote" : ""}`}
      onClick={() => {
        if (task) {
          let metadata: Array<{ id: string; authorId: string }> = [];
          if (task.commentMetadata) {
            try {
              metadata = JSON.parse(task.commentMetadata);
            } catch (e) {}
          }
          const allIds = metadata.map((c) => c.id);
          localStorage.setItem(`read_comments_ids_${taskId}`, JSON.stringify(allIds));
          setUnreadCount(0);
        }
        onClick();
      }}
    >
      {/* Top row: Time badge & Remote peer presence */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className={`time-badge-pill ${themeColor}`}>
          <Clock size={12} className="spin-gently" />
          <span>{task.time || "Flexible"}</span>
        </div>

        {isFocusedByRemote && (
          <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
            {focusingCollaborators.map((c, i) => (
              <div
                key={i}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  border: `2px solid ${c.color}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 8,
                  fontWeight: 700,
                  color: "#ffffff",
                  backgroundColor: c.color,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                }}
                title={`${c.name} is viewing`}
              >
                {c.avatarUrl ? (
                  <img
                    src={c.avatarUrl}
                    alt={c.name}
                    style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                  />
                ) : (
                  c.name.substring(0, 1).toUpperCase()
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Middle row: Card title, description, and thumbnail */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="whiteboard-task-card-title" style={{ marginBottom: 4 }}>
            {task.title || "Untitled Activity"}
          </div>
          {task.description && (
            <div 
              className="whiteboard-task-card-desc" 
              style={{
                backgroundColor: "#f8fafc",
                borderRadius: 8,
                padding: "8px 10px",
                border: "1px solid #f1f5f9",
                fontSize: 11,
                color: "#475569",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <span 
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 3,
                  backgroundColor: accentColorMap[themeColor],
                }} 
              />
              <span style={{ paddingLeft: 6, display: "block" }}>{task.description}</span>
            </div>
          )}
        </div>
        {coverSrc && (
          <div className="whiteboard-task-card-thumbnail">
            <img src={coverSrc} alt={task.title} />
          </div>
        )}
      </div>

      {/* Bottom row: Details trigger & Cost tag */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: 8, marginTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#94a3b8", fontSize: 11, fontWeight: 500 }}>
            <MessageSquare size={13} />
            <span>Details</span>
            {unreadCount > 0 && (
              <span
                style={{
                  backgroundColor: "#ef4444",
                  color: "#ffffff",
                  fontSize: 9,
                  fontWeight: 700,
                  borderRadius: "50%",
                  minWidth: 16,
                  height: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px",
                  marginLeft: 4,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                }}
              >
                {unreadCount}
              </span>
            )}
          </div>
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: "2px 4px",
                display: "flex",
                alignItems: "center",
                borderRadius: 4,
                transition: "color 0.2s, background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#ef4444";
                e.currentTarget.style.backgroundColor = "#fee2e2";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#94a3b8";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
              title="Delete Activity"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>

        <div className="cost-tag-whiteboard hover-wiggle">
          {task.cost && task.cost.trim() !== "" && task.cost.trim().toUpperCase() !== "0 VND" ? (
            `COST: ${task.cost}`
          ) : (
            "FREE"
          )}
        </div>
      </div>
    </div>
  );
};
