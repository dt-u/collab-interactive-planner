import React, { useEffect, useState, useCallback, useRef } from "react";
import * as Y from "yjs";
import { useParams } from "react-router-dom";
import { useYjsDocument } from "../../collaborative-editor/hooks/useYjsDocument.js";
import { httpClient } from "../../../shared/api/http-client.js";
import { X, Send, Paperclip, MessageSquare, Trash2, FileText, Clock, DollarSign, Image } from "lucide-react";
import { Spinner } from "../../../shared/ui/spinner/Spinner.js";
import {
  getSharedColumns,
  getSharedColumnOrder,
  getSharedColumnMetadata,
} from "@collab-planner/yjs-utils";

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
  createdAt: Date;
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
  
  // Time states
  const [timeHour, setTimeHour] = useState("");
  const [timeMinute, setTimeMinute] = useState("");
  const [timePeriod, setTimePeriod] = useState("AM");
  const [timeError, setTimeError] = useState("");

  // Cost states
  const [costAmount, setCostAmount] = useState("");
  const [costCurrency, setCostCurrency] = useState("VND");
  const [costError, setCostError] = useState("");

  const [localImage, setLocalImage] = useState("");
  
  // Comments and Media states
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  
  const [media, setMedia] = useState<MediaDto[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  
  // File download and preview states
  const [activeActionMedia, setActiveActionMedia] = useState<MediaDto | null>(null);
  const [activePreviewMedia, setActivePreviewMedia] = useState<MediaDto | null>(null);

  const isBackdropMouseDown = useRef(false);

  // Update local input values when task updates from Yjs
  useEffect(() => {
    if (task) {
      setLocalTitle(task.title);
      setLocalDesc(task.description);
      setLocalImage(task.image || "");

      // Parse time (format: "hh:mm Period")
      if (task.time) {
        const timeParts = task.time.split(" ");
        if (timeParts.length === 2) {
          const hm = timeParts[0].split(":");
          if (hm.length === 2) {
            setTimeHour(hm[0]);
            setTimeMinute(hm[1]);
          }
          setTimePeriod(timeParts[1]);
        } else {
          setTimeHour("");
          setTimeMinute("");
          setTimePeriod("AM");
        }
      } else {
        setTimeHour("");
        setTimeMinute("");
        setTimePeriod("AM");
      }
      setTimeError("");

      // Parse cost (format: "Amount Currency")
      if (task.cost) {
        const costParts = task.cost.split(" ");
        if (costParts.length === 2) {
          setCostAmount(costParts[0]);
          setCostCurrency(costParts[1]);
        } else {
          setCostAmount(task.cost);
          setCostCurrency("VND");
        }
      } else {
        setCostAmount("");
        setCostCurrency("VND");
      }
      setCostError("");
    }
  }, [task]);

  const fetchComments = useCallback(async () => {
    try {
      setCommentsLoading(true);
      const res = await httpClient.get(`/items/${taskId}/comments`, { params: { planId } });
      const commentsList = res.data?.data || [];
      setComments(commentsList);
      
      // Update comment count in Yjs if it differs
      if (task && (task.commentCount || 0) !== commentsList.length) {
        updateTask({ commentCount: commentsList.length });
      }
    } catch (err) {
      console.error("Failed to fetch comments:", err);
    } finally {
      setCommentsLoading(false);
    }
  }, [taskId, planId, task, updateTask]);

  const fetchMedia = useCallback(async () => {
    try {
      setMediaLoading(true);
      const res = await httpClient.get(`/items/${taskId}/media`, { params: { planId } });
      setMedia(res.data?.data || []);
    } catch (err) {
      console.error("Failed to fetch media:", err);
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

  const validateAndSaveTime = (hour: string, minute: string, period: string) => {
    if (!task) return;
    
    const hTrim = hour.trim();
    const mTrim = minute.trim();

    if (hTrim === "" && mTrim === "") {
      setTimeError("");
      updateTask({ time: "" });
      return;
    }

    // Validate hour: only digits, 1-12
    if (hTrim !== "" && (!/^\d+$/.test(hTrim) || Number(hTrim) < 1 || Number(hTrim) > 12)) {
      setTimeError("Hour must be between 1 and 12.");
      return;
    }

    // Validate minute: only digits, 0-59
    if (mTrim !== "" && (!/^\d+$/.test(mTrim) || Number(mTrim) < 0 || Number(mTrim) > 59)) {
      setTimeError("Minute must be between 0 and 59.");
      return;
    }

    const formattedMinute = mTrim.length === 1 ? `0${mTrim}` : mTrim;
    const formattedHour = hTrim;

    setTimeError("");
    const newTime = `${formattedHour}:${formattedMinute} ${period}`;
    if (newTime !== task.time) {
      updateTask({ time: newTime });
    }
  };

  const validateAndSaveCost = (amount: string, currency: string) => {
    if (!task) return;

    const aTrim = amount.trim();

    if (aTrim === "") {
      setCostError("");
      updateTask({ cost: "" });
      return;
    }

    // Validate amount: numeric (optional decimal)
    if (!/^\d+(\.\d+)?$/.test(aTrim)) {
      setCostError("Cost must be a valid number.");
      return;
    }

    setCostError("");
    const newCost = `${aTrim} ${currency}`;
    if (newCost !== task.cost) {
      updateTask({ cost: newCost });
    }
  };

  const handleImageBlur = () => {
    if (task && localImage !== (task.image || "")) {
      updateTask({ image: localImage });
    }
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newColId = e.target.value;
    if (!yDoc || !task) return;

    const sourceCol = task.status;
    const destCol = newColId;
    if (sourceCol === destCol) return;

    const columnsMap = getSharedColumns(yDoc);
    const sourceArray = columnsMap.get(sourceCol);
    const destArray = columnsMap.get(destCol);

    if (!sourceArray || !destArray) return;

    yDoc.transact(() => {
      const sourceIndex = sourceArray.toArray().indexOf(taskId);
      if (sourceIndex !== -1) {
        sourceArray.delete(sourceIndex);
      }
      destArray.push([taskId]);
      updateTask({ status: destCol });
    });
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await httpClient.post(`/items/${taskId}/comments`, { content: newComment }, { params: { planId } });
      setNewComment("");
      await fetchComments();
    } catch (err) {
      console.error("Failed to add comment:", err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await httpClient.delete(`/comments/${commentId}`, { params: { planId } });
      await fetchComments();
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  };

  const handleDownload = (m: MediaDto) => {
    const a = document.createElement("a");
    a.href = m.fileUrl;
    a.download = m.fileName;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDeleteMedia = async (mediaId: string) => {
    try {
      await httpClient.delete(`/media/${mediaId}`, { params: { planId } });
      await fetchMedia();
    } catch (err) {
      console.error("Failed to delete media attachment:", err);
    }
  };

  if (!isOpen || !task) return null;

  // Retrieve days metadata list dynamically from Yjs for status dropdown
  const orderArray = yDoc ? getSharedColumnOrder(yDoc).toArray() : [];
  const metadataMap = yDoc ? getSharedColumnMetadata(yDoc) : null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        isBackdropMouseDown.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (isBackdropMouseDown.current && e.target === e.currentTarget) {
          onClose();
        }
        isBackdropMouseDown.current = false;
      }}
    >
      <div
        className="modal-card"
        style={{ maxWidth: 880, width: "95%", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 24 }}
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
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileText size={20} className="workspace-icon" />
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
              Itinerary Item Editor
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
        <div className="task-detail-grid" style={{ overflowY: "auto", flex: 1, paddingRight: 4 }}>
          {/* Main Column */}
          <div className="detail-main-col">
            <div className="form-group">
              <label>Itinerary Activity Title</label>
              <input
                type="text"
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                onBlur={handleTitleBlur}
                placeholder="e.g. CAFE HOPPING, BBQ NIGHT..."
                style={{ fontSize: 16, fontWeight: 600 }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="form-group">
                <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock size={12} />
                  <span>Time of Day</span>
                </label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="text"
                    style={{ width: "60px", textAlign: "center" }}
                    placeholder="HH"
                    maxLength={2}
                    value={timeHour}
                    onChange={(e) => setTimeHour(e.target.value)}
                    onBlur={() => validateAndSaveTime(timeHour, timeMinute, timePeriod)}
                  />
                  <span>:</span>
                  <input
                    type="text"
                    style={{ width: "60px", textAlign: "center" }}
                    placeholder="MM"
                    maxLength={2}
                    value={timeMinute}
                    onChange={(e) => setTimeMinute(e.target.value)}
                    onBlur={() => validateAndSaveTime(timeHour, timeMinute, timePeriod)}
                  />
                  <select
                    style={{ flex: 1 }}
                    value={timePeriod}
                    onChange={(e) => {
                      const newPeriod = e.target.value;
                      setTimePeriod(newPeriod);
                      validateAndSaveTime(timeHour, timeMinute, newPeriod);
                    }}
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
                {timeError && (
                  <span style={{ color: "#f87171", fontSize: 11, marginTop: 4, display: "block" }}>
                    {timeError}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <DollarSign size={12} />
                  <span>Estimated Cost</span>
                </label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="text"
                    style={{ flex: 2 }}
                    placeholder="Amount"
                    value={costAmount}
                    onChange={(e) => setCostAmount(e.target.value)}
                    onBlur={() => validateAndSaveCost(costAmount, costCurrency)}
                  />
                  <select
                    style={{ flex: 1 }}
                    value={costCurrency}
                    onChange={(e) => {
                      const newCurrency = e.target.value;
                      setCostCurrency(newCurrency);
                      validateAndSaveCost(costAmount, newCurrency);
                    }}
                  >
                    <option value="VND">VND</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
                {costError && (
                  <span style={{ color: "#f87171", fontSize: 11, marginTop: 4, display: "block" }}>
                    {costError}
                  </span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Image size={12} />
                <span>Card Cover Image URL</span>
              </label>
              <input
                type="text"
                value={localImage}
                onChange={(e) => setLocalImage(e.target.value)}
                onBlur={handleImageBlur}
                placeholder="e.g. https://images.unsplash.com/... or paste image address"
              />
            </div>

            <div className="form-group">
              <label>Description & Notes</label>
              <textarea
                value={localDesc}
                onChange={(e) => setLocalDesc(e.target.value)}
                onBlur={handleDescBlur}
                placeholder="Add collaborative description details here..."
                rows={5}
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
                <div className="media-panel" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {media.length === 0 ? (
                    <span style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>
                      No attachments added yet.
                    </span>
                  ) : (
                    media.map((m) => (
                      <div key={m.id} className="media-item" style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, border: "1px solid var(--border-color)", borderRadius: 8, backgroundColor: "rgba(255,255,255,0.02)" }}>
                        <div
                          onClick={() => setActiveActionMedia(m)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            cursor: "pointer",
                            padding: "6px 8px",
                            borderRadius: 4,
                            transition: "background-color 0.2s",
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)"}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                            <Paperclip size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />
                            <span className="media-item-name" style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {m.fileName}
                            </span>
                            <span className="media-item-size" style={{ opacity: 0.7, fontSize: 11, flexShrink: 0 }}>
                              ({Math.round(m.fileSize / 1024)} KB)
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: "var(--primary)", fontWeight: 500, flexShrink: 0 }}>Options</span>
                        </div>
                        
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 8 }}>
                          {/* Replace File */}
                          <input
                            type="file"
                            id={`replace-input-${m.id}`}
                            style={{ display: "none" }}
                            onChange={async (e) => {
                              const selectedFile = e.target.files?.[0];
                              if (!selectedFile) return;

                              const formData = new FormData();
                              formData.append("file", selectedFile);
                              
                              try {
                                setMediaLoading(true);
                                await httpClient.delete(`/media/${m.id}`, { params: { planId } });
                                await httpClient.post(`/items/${taskId}/media`, formData, {
                                  params: { planId },
                                  headers: { "Content-Type": "multipart/form-data" },
                                });
                                await fetchMedia();
                              } catch (err) {
                                console.error("Failed to replace attachment:", err);
                              } finally {
                                setMediaLoading(false);
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => document.getElementById(`replace-input-${m.id}`)?.click()}
                            style={{
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid var(--border-color)",
                              padding: "4px 8px",
                              borderRadius: 4,
                              fontSize: 11,
                              cursor: "pointer",
                              color: "var(--text-color)",
                            }}
                          >
                            Change File
                          </button>
                          
                          <button
                            type="button"
                            className="media-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMedia(m.id);
                            }}
                            title="Delete Attachment"
                            style={{
                              background: "rgba(239, 68, 68, 0.1)",
                              border: "none",
                              padding: "4px 8px",
                              borderRadius: 4,
                              cursor: "pointer",
                              color: "#ef4444",
                              display: "flex",
                              alignItems: "center",
                              fontSize: 11,
                            }}
                          >
                            <Trash2 size={12} style={{ marginRight: 4 }} />
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Direct File Upload button */}
              <div style={{ marginTop: 16 }}>
                <input
                  type="file"
                  id="task-file-upload-input"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const selectedFile = e.target.files?.[0];
                    if (!selectedFile) return;

                    const formData = new FormData();
                    formData.append("file", selectedFile);
                    
                    try {
                      setMediaLoading(true);
                      await httpClient.post(`/items/${taskId}/media`, formData, {
                        params: { planId },
                        headers: { "Content-Type": "multipart/form-data" },
                      });
                      await fetchMedia();
                    } catch (err) {
                      console.error("Failed to upload file attachment:", err);
                    } finally {
                      setMediaLoading(false);
                    }
                  }}
                />
                <button
                  type="button"
                  className="media-upload-btn"
                  onClick={() => document.getElementById("task-file-upload-input")?.click()}
                  style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", width: "100%", padding: "10px 16px" }}
                >
                  <Paperclip size={14} />
                  Upload File
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar Column */}
          <div className="detail-side-col">
            <div className="form-group">
              <label>Day / Timeline Milestone</label>
              <select value={task.status} onChange={handleStatusChange}>
                {orderArray.map((colId) => {
                  const meta = metadataMap?.get(colId) as any;
                  return (
                    <option key={colId} value={colId}>
                      {meta?.title || `DAY ${colId.toUpperCase()}`}
                    </option>
                  );
                })}
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

      {/* Action Menu Modal Overlay */}
      {activeActionMedia && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
          }}
          onClick={() => setActiveActionMedia(null)}
        >
          <div
            style={{
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 8,
              width: 320,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ margin: 0, fontSize: 14, color: "#fff", textAlign: "center", borderBottom: "1px solid #334155", paddingBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {activeActionMedia.fileName}
            </h4>
            <button
              onClick={() => {
                setActivePreviewMedia(activeActionMedia);
                setActiveActionMedia(null);
              }}
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                color: "#fff",
                border: "1px solid #334155",
                padding: "10px 12px",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: 500,
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)"}
            >
              Preview File
            </button>
            <button
              onClick={() => {
                handleDownload(activeActionMedia);
                setActiveActionMedia(null);
              }}
              style={{
                backgroundColor: "var(--primary, #0ea5e9)",
                color: "#fff",
                border: "none",
                padding: "10px 12px",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Download File
            </button>
            <button
              onClick={() => setActiveActionMedia(null)}
              style={{
                backgroundColor: "transparent",
                color: "#94a3b8",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                marginTop: 4,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Preview Modal Overlay */}
      {activePreviewMedia && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 24,
          }}
          onClick={() => setActivePreviewMedia(null)}
        >
          <div
            style={{
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 8,
              maxWidth: "90%",
              maxHeight: "90%",
              width: 700,
              height: 550,
              display: "flex",
              flexDirection: "column",
              padding: 24,
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #334155", paddingBottom: 12, marginBottom: 16, flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%" }}>
                Preview: {activePreviewMedia.fileName}
              </h3>
              <button
                onClick={() => setActivePreviewMedia(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>
            
            <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
              {activePreviewMedia.mimeType.startsWith("image/") ? (
                <img
                  src={activePreviewMedia.fileUrl}
                  alt={activePreviewMedia.fileName}
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                />
              ) : activePreviewMedia.mimeType === "application/pdf" ? (
                <iframe
                  src={activePreviewMedia.fileUrl}
                  title={activePreviewMedia.fileName}
                  style={{ width: "100%", height: "100%", border: "none", backgroundColor: "#fff" }}
                />
              ) : (
                <div style={{ textAlign: "center", color: "#94a3b8" }}>
                  <p>Preview not available for this file type</p>
                  <button
                    onClick={() => handleDownload(activePreviewMedia)}
                    style={{
                      backgroundColor: "var(--primary, #0ea5e9)",
                      color: "#fff",
                      border: "none",
                      padding: "10px 20px",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontWeight: 600,
                      marginTop: 12,
                    }}
                  >
                    Download File
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
