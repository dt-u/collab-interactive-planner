import React, { useEffect, useState, useCallback } from "react";
import * as Y from "yjs";
import { useParams } from "react-router-dom";
import { useYjsDocument } from "../../collaborative-editor/hooks/useYjsDocument.js";
import { httpClient } from "../../../shared/api/http-client.js";
import { X, Send, Paperclip, MessageSquare, Trash2, Calendar, FileText } from "lucide-react";
import { Spinner } from "../../../shared/ui/spinner/Spinner.js";

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  yDoc: Y.Doc | undefined;
}

interface CommentDto {
  id: string;
  itemId: string;
  authorId: {
    _id: string;
    name: string;
    avatarUrl?: string;
  };
  content: string;
  createdAt: string;
}

interface MediaDto {
  id: string;
  itemId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploaderId: string;
  createdAt: Date; // wait, let's keep it as is
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  isOpen,
  onClose,
  taskId,
  yDoc,
}) => {
  const { planId } = useParams<{ planId: string }>();
  const { task, updateTask } = useYjsDocument(yDoc, taskId);
  
  // Local state to avoid input lag
  const [localTitle, setLocalTitle] = useState("");
  const [localDesc, setLocalDesc] = useState("");
  
  // Comments and Media states
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  
  const [media, setMedia] = useState<MediaDto[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mockFileName, setMockFileName] = useState("");
  const [mockFileUrl, setMockFileUrl] = useState("");

  // Update local input values when task updates from Yjs
  useEffect(() => {
    if (task) {
      setLocalTitle(task.title);
      setLocalDesc(task.description);
    }
  }, [task]);

  const fetchComments = useCallback(async () => {
    try {
      setCommentsLoading(true);
      const res = await httpClient.get(`/items/${taskId}/comments`, { params: { planId } });
      setComments(res.data?.data || []);
    } catch (err) {
      console.error("❌ Failed to fetch comments:", err);
    } finally {
      setCommentsLoading(false);
    }
  }, [taskId, planId]);

  const fetchMedia = useCallback(async () => {
    try {
      setMediaLoading(true);
      const res = await httpClient.get(`/items/${taskId}/media`, { params: { planId } });
      setMedia(res.data?.data || []);
    } catch (err) {
      console.error("❌ Failed to fetch media:", err);
    } finally {
      setMediaLoading(false);
    }
  }, [taskId, planId]);

  useEffect(() => {
    if (isOpen && taskId) {
      fetchComments();
      fetchMedia();
    }
  }, [isOpen, taskId, fetchComments, fetchMedia]);

  const handleTitleBlur = () => {
    if (task && localTitle !== task.title) {
      updateTask({ title: localTitle });
    }
  };

  const handleDescBlur = () => {
    if (task && localDesc !== task.description) {
      updateTask({ description: localDesc });
    }
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const status = e.target.value as "todo" | "in_progress" | "done";
    updateTask({ status });
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await httpClient.post(`/items/${taskId}/comments`, { content: newComment }, { params: { planId } });
      setNewComment("");
      await fetchComments();
    } catch (err) {
      console.error("❌ Failed to add comment:", err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await httpClient.delete(`/comments/${commentId}`, { params: { planId } });
      await fetchComments();
    } catch (err) {
      console.error("❌ Failed to delete comment:", err);
    }
  };

  const handleAddMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mockFileName.trim() || !mockFileUrl.trim()) return;

    try {
      await httpClient.post(`/items/${taskId}/media`, {
        fileName: mockFileName,
        fileUrl: mockFileUrl,
        fileSize: Math.floor(Math.random() * 5000000) + 10000,
        mimeType: mockFileName.endsWith(".pdf") ? "application/pdf" : "image/png",
      }, { params: { planId } });
      setMockFileName("");
      setMockFileUrl("");
      await fetchMedia();
    } catch (err) {
      console.error("❌ Failed to add media attachment:", err);
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    try {
      await httpClient.delete(`/media/${mediaId}`, { params: { planId } });
      await fetchMedia();
    } catch (err) {
      console.error("❌ Failed to delete media attachment:", err);
    }
  };

  if (!isOpen || !task) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: 840, width: "90%", padding: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--border-color)",
            paddingBottom: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileText size={20} className="workspace-icon" />
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
              Task Editor
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content Grid */}
        <div className="task-detail-grid">
          {/* Main Column */}
          <div className="detail-main-col">
            <div className="form-group">
              <label>Task Title</label>
              <input
                type="text"
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                onBlur={handleTitleBlur}
                placeholder="Enter task title..."
                style={{ fontSize: 16, fontWeight: 600 }}
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={localDesc}
                onChange={(e) => setLocalDesc(e.target.value)}
                onBlur={handleDescBlur}
                placeholder="Add collaborative description details here..."
                rows={6}
              />
            </div>

            {/* Media Section */}
            <div>
              <h4 className="task-section-title">
                <Paperclip size={14} style={{ marginRight: 6 }} />
                Attachments
              </h4>
              
              {mediaLoading ? (
                <div style={{ padding: 12 }}><Spinner size="small" /></div>
              ) : (
                <div className="media-panel">
                  {media.length === 0 ? (
                    <span style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>
                      No attachments added yet.
                    </span>
                  ) : (
                    media.map((m) => (
                      <div key={m.id} className="media-item">
                        <div className="media-item-info">
                          <Paperclip size={14} style={{ color: "var(--primary)" }} />
                          <a
                            href={m.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="media-item-name"
                          >
                            {m.fileName}
                          </a>
                          <span className="media-item-size">
                            ({Math.round(m.fileSize / 1024)} KB)
                          </span>
                        </div>
                        <button
                          className="media-delete-btn"
                          onClick={() => handleDeleteMedia(m.id)}
                          title="Delete Attachment"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Add Mock Media Form */}
              <form onSubmit={handleAddMedia} className="media-uploader" style={{ marginTop: 16 }}>
                <div className="media-upload-fields">
                  <input
                    type="text"
                    placeholder="File Name (e.g. wireframe.png)"
                    value={mockFileName}
                    onChange={(e) => setMockFileName(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="File URL (e.g. http://example.com/file)"
                    value={mockFileUrl}
                    onChange={(e) => setMockFileUrl(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="media-upload-btn">
                  Attach Simulated File
                </button>
              </form>
            </div>
          </div>

          {/* Sidebar Column */}
          <div className="detail-side-col">
            <div className="form-group">
              <label>Status</label>
              <select value={task.status} onChange={handleStatusChange}>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>

            {/* Comments Section */}
            <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              <h4 className="task-section-title">
                <MessageSquare size={14} style={{ marginRight: 6 }} />
                Comments
              </h4>

              {commentsLoading ? (
                <div style={{ padding: 12 }}><Spinner size="small" /></div>
              ) : (
                <div className="comments-panel" style={{ flex: 1 }}>
                  {comments.length === 0 ? (
                    <span style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>
                      No comments yet. Write the first one!
                    </span>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="comment-bubble">
                        <div className="comment-header">
                          <span className="comment-author">{c.authorId?.name || "Collaborator"}</span>
                          <span className="comment-date">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="comment-body">{c.content}</div>
                        <button
                          className="comment-delete-btn"
                          onClick={() => handleDeleteComment(c.id)}
                          title="Delete Comment"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Add Comment Form */}
              <form onSubmit={handleAddComment} className="comment-composer" style={{ marginTop: 16 }}>
                <input
                  type="text"
                  placeholder="Post a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  required
                />
                <button type="submit" className="comment-send-btn">
                  <Send size={14} />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
