import React, { useEffect, useState } from "react";
import * as Y from "yjs";
import { useParams } from "react-router-dom";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useYjsDocument } from "../../collaborative-editor/hooks/useYjsDocument.js";
import { Clock, DollarSign, FileText } from "lucide-react";
import { httpClient } from "../../../shared/api/http-client.js";

interface BoardTaskCardProps {
  taskId: string;
  yDoc: Y.Doc | undefined;
  onClick: () => void;
  focusingCollaborators: Array<{
    name: string;
    color: string;
    avatarUrl?: string;
  }>;
}

export const BoardTaskCard: React.FC<BoardTaskCardProps> = ({
  taskId,
  yDoc,
  onClick,
  focusingCollaborators,
}) => {
  const { planId } = useParams<{ planId: string }>();
  const { task } = useYjsDocument(yDoc, taskId);
  const [fallbackImage, setFallbackImage] = useState<string | null>(null);

  // Fetch attachments to use as cover fallback if task.image is empty
  useEffect(() => {
    const fetchAttachmentsFallback = async () => {
      if (!task || task.image) return;
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
  }, [taskId, task?.image, planId]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: taskId });

  const isFocusedByRemote = focusingCollaborators.length > 0;
  const focusColor = isFocusedByRemote ? focusingCollaborators[0].color : undefined;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    border: focusColor ? `2px solid ${focusColor}` : undefined,
    boxShadow: focusColor ? `0 0 15px ${focusColor}` : undefined,
  };

  if (!task) return null;

  const coverSrc = task.image || fallbackImage;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`task-card ${isFocusedByRemote ? "card-focused-remote" : ""}`}
      onClick={onClick}
    >
      {/* Cover Image / Gradient */}
      {coverSrc ? (
        <div className="task-card-cover-container">
          <img src={coverSrc} alt={task.title} className="task-card-cover" />
        </div>
      ) : (
        <div className="task-card-cover-container neon-gradient-cover" />
      )}

      {/* Time Badge (Glassmorphic) */}
      <div className="time-badge">
        <Clock size={11} className="time-badge-icon" />
        <span>{task.time || "Flexible"}</span>
      </div>

      <div className="task-card-content" style={{ marginTop: 12 }}>
        <div className="task-card-title">{task.title || "Untitled Activity"}</div>
        {task.description && (
          <div className="task-card-desc">{task.description}</div>
        )}
      </div>
      
      <div className="task-card-footer" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Cost Tag */}
          <div className="cost-tag">
            <DollarSign size={12} style={{ marginRight: 2 }} />
            <span>{task.cost || "Free"}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <FileText size={12} style={{ color: "var(--text-muted)" }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Details
            </span>
          </div>
        </div>

        {/* Focusing Remote Users */}
        {isFocusedByRemote && (
          <div className="task-card-assignees">
            {focusingCollaborators.map((c, i) => (
              <div
                key={i}
                className="card-assignee-bubble"
                style={{ borderColor: c.color }}
                title={`${c.name} is viewing this task`}
              >
                {c.avatarUrl ? (
                  <img
                    src={c.avatarUrl}
                    alt={c.name}
                    style={{ width: "100%", height: "100%", borderRadius: "50%" }}
                  />
                ) : (
                  c.name.substring(0, 2)
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
