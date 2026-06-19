import React from "react";
import * as Y from "yjs";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useYjsDocument } from "../../collaborative-editor/hooks/useYjsDocument.js";
import { FileText } from "lucide-react";

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
  const { task } = useYjsDocument(yDoc, taskId);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: taskId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  if (!task) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="task-card"
      onClick={onClick}
    >
      <div className="task-card-title">{task.title || "Untitled Task"}</div>
      {task.description && (
        <div className="task-card-desc">{task.description}</div>
      )}
      
      <div className="task-card-footer">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <FileText size={12} style={{ color: "var(--text-muted)" }} />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Details
          </span>
        </div>

        {/* Focusing Remote Users */}
        {focusingCollaborators.length > 0 && (
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

      {/* Focus border glow if remote users are viewing */}
      {focusingCollaborators.length > 0 && (
        <div
          className="card-focus-indicator"
          style={{
            backgroundColor: focusingCollaborators[0].color,
            boxShadow: `0 0 8px ${focusingCollaborators[0].color}`,
          }}
        />
      )}
    </div>
  );
};
