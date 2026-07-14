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
  const [customCurrency, setCustomCurrency] = useState("");
  const [costError, setCostError] = useState("");

  const [localImage, setLocalImage] = useState("");
  
  // Comments and Media states
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  
  const [media, setMedia] = useState<MediaDto[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  
  // File download and preview states
  const [activeActionMediaId, setActiveActionMediaId] = useState<string | null>(null);
  const [activePreviewMedia, setActivePreviewMedia] = useState<MediaDto | null>(null);
  
  // Cover Drag & Drop states
  const [isDragOver, setIsDragOver] = useState(false);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  const isBackdropMouseDown = useRef(false);

  // Update local input values when task updates from Yjs
  useEffect(() => {
    if (task) {
      if (document.activeElement !== document.getElementById("task-title-input")) {
        setLocalTitle(task.title);
      }
      if (document.activeElement !== document.getElementById("task-desc-input")) {
        setLocalDesc(task.description);
      }
      setLocalImage(task.image || "");

      // Parse time (format: "hh:mm Period")
      if (task.time) {
        const timeParts = task.time.split(" ");
        if (timeParts.length === 2) {
          const hm = timeParts[0].split(":");
          if (hm.length === 2) {
            if (document.activeElement !== document.getElementById("task-hour-input")) {
              setTimeHour(hm[0]);
            }
            if (document.activeElement !== document.getElementById("task-minute-input")) {
              setTimeMinute(hm[1]);
            }
          }
          setTimePeriod(timeParts[1]);
        } else {
          if (document.activeElement !== document.getElementById("task-hour-input")) {
            setTimeHour("");
          }
          if (document.activeElement !== document.getElementById("task-minute-input")) {
            setTimeMinute("");
          }
          setTimePeriod("AM");
        }
      } else {
        if (document.activeElement !== document.getElementById("task-hour-input")) {
          setTimeHour("");
        }
        if (document.activeElement !== document.getElementById("task-minute-input")) {
          setTimeMinute("");
        }
        setTimePeriod("AM");
      }
      setTimeError("");

      // Parse cost (format: "Amount Currency")
      if (task.cost) {
        const costParts = task.cost.split(" ");
        if (costParts.length === 2) {
          if (document.activeElement !== document.getElementById("task-cost-amount-input")) {
            setCostAmount(costParts[0]);
          }
          const isStandard = ["VND", "USD", "EUR", "GBP", "JPY", "CNY", "KRW"].includes(costParts[1]);
          if (isStandard) {
            setCostCurrency(costParts[1]);
            setCustomCurrency("");
          } else {
            setCostCurrency("Other");
            setCustomCurrency(costParts[1]);
          }
        } else {
          if (document.activeElement !== document.getElementById("task-cost-amount-input")) {
            setCostAmount(task.cost);
          }
          setCostCurrency("VND");
          setCustomCurrency("");
        }
      } else {
        if (document.activeElement !== document.getElementById("task-cost-amount-input")) {
          setCostAmount("");
        }
        setCostCurrency("VND");
        setCustomCurrency("");
      }
      setCostError("");
    }
  }, [task]);

  const fetchComments = useCallback(async () => {
    try {
      setCommentsLoading(true);
      const res = await httpClient.get(`/items/${taskId}/comments`, { params: { planId } });
      setComments(res.data?.data || []);
    } catch (err) {
      console.error("Failed to fetch comments:", err);
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
      console.error("Failed to fetch media:", err);
    } finally {
      setMediaLoading(false);
    }
  }, [taskId, planId]);

  const hasLoadedComments = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      hasLoadedComments.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && taskId && !hasLoadedComments.current) {
      const loadInitialComments = async () => {
        try {
          setCommentsLoading(true);
          const res = await httpClient.get(`/items/${taskId}/comments`, { params: { planId } });
          const commentsList = res.data?.data || [];
          setComments(commentsList);
          hasLoadedComments.current = true;
          if (task && (task.commentCount || 0) !== commentsList.length) {
            updateTask({ commentCount: commentsList.length });
          }
        } catch (err) {
          console.error("Failed to load initial comments:", err);
        } finally {
          setCommentsLoading(false);
        }
      };

      loadInitialComments();
      fetchMedia();
    }
  }, [isOpen, taskId, planId, task, updateTask, fetchMedia]);

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

  const validateAndSaveCost = (amount: string, currency: string, customCurr?: string) => {
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

    const finalCurrency = currency === "Other" ? (customCurr || "").trim() : currency;
    
    if (currency === "Other" && finalCurrency === "") {
      setCostError("Please specify custom currency.");
      return;
    }

    setCostError("");
    const newCost = `${aTrim} ${finalCurrency}`;
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
      
      const res = await httpClient.get(`/items/${taskId}/comments`, { params: { planId } });
      const commentsList = res.data?.data || [];
      setComments(commentsList);
      updateTask({ commentCount: commentsList.length });
    } catch (err) {
      console.error("Failed to add comment:", err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await httpClient.delete(`/comments/${commentId}`, { params: { planId } });
      
      const res = await httpClient.get(`/items/${taskId}/comments`, { params: { planId } });
      const commentsList = res.data?.data || [];
      setComments(commentsList);
      updateTask({ commentCount: commentsList.length });
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

  const handleCoverUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      setMediaLoading(true);
      const res = await httpClient.post(`/items/${taskId}/media`, formData, {
        params: { planId },
        headers: { "Content-Type": "multipart/form-data" },
      });
      const fileUrl = res.data?.data?.fileUrl;
      if (fileUrl) {
        updateTask({ image: fileUrl });
      }
      await fetchMedia();
    } catch (err) {
      console.error("Failed to upload cover image:", err);
    } finally {
      setMediaLoading(false);
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
                id="task-title-input"
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
                    id="task-hour-input"
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
                    id="task-minute-input"
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
                    id="task-cost-amount-input"
                    type="text"
                    style={{ flex: 2 }}
                    placeholder="Amount"
                    value={costAmount}
                    onChange={(e) => setCostAmount(e.target.value)}
                    onBlur={() => validateAndSaveCost(costAmount, costCurrency, customCurrency)}
                  />
                  <select
                    style={{ flex: 1 }}
                    value={costCurrency}
                    onChange={(e) => {
                      const newCurrency = e.target.value;
                      setCostCurrency(newCurrency);
                      validateAndSaveCost(costAmount, newCurrency, customCurrency);
                    }}
                  >
                    <option value="VND">VND</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                    <option value="CNY">CNY</option>
                    <option value="KRW">KRW</option>
                    <option value="Other">Other</option>
                  </select>
                  {costCurrency === "Other" && (
                    <input
                      id="task-custom-currency-input"
                      type="text"
                      style={{ width: "80px" }}
                      placeholder="Currency"
                      value={customCurrency}
                      onChange={(e) => setCustomCurrency(e.target.value)}
                      onBlur={() => validateAndSaveCost(costAmount, costCurrency, customCurrency)}
                    />
                  )}
                </div>
                {costError && (
                  <span style={{ color: "#f87171", fontSize: 11, marginTop: 4, display: "block" }}>
                    {costError}
                  </span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>Card Cover Image</label>
              {task.image ? (
                <div
                  className="cover-image-container"
                  style={{
                    position: "relative",
                    borderRadius: 8,
                    overflow: "hidden",
                    height: 180,
                    width: "100%",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <img
                    src={task.image}
                    alt="Card Cover"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <div
                    className="cover-image-overlay"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "rgba(0,0,0,0.5)",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 16,
                      opacity: 0,
                      transition: "opacity 0.2s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = "0"}
                  >
                    <button
                      type="button"
                      onClick={() => coverFileInputRef.current?.click()}
                      style={{
                        background: "var(--primary, #0ea5e9)",
                        color: "#fff",
                        border: "none",
                        padding: "8px 12px",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      Change Image
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTask({ image: "" })}
                      style={{
                        background: "#ef4444",
                        color: "#fff",
                        border: "none",
                        padding: "8px 12px",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 12,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </div>
                  <input
                    type="file"
                    ref={coverFileInputRef}
                    style={{ display: "none" }}
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCoverUpload(file);
                    }}
                  />
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleCoverUpload(file);
                  }}
                  onClick={() => coverFileInputRef.current?.click()}
                  style={{
                    border: isDragOver ? "2px dashed var(--primary, #0ea5e9)" : "2px dashed var(--border-color, #334155)",
                    borderRadius: 8,
                    height: 120,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    backgroundColor: isDragOver ? "rgba(14, 165, 233, 0.05)" : "rgba(255,255,255,0.01)",
                    transition: "border-color 0.2s, background-color 0.2s",
                    color: "var(--text-muted)",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 24, fontWeight: 300 }}>+</span>
                  <span style={{ fontSize: 13 }}>Click to upload or drag & drop image cover</span>
                  <input
                    type="file"
                    ref={coverFileInputRef}
                    style={{ display: "none" }}
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCoverUpload(file);
                    }}
                  />
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Description & Notes</label>
              <textarea
                id="task-desc-input"
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
                      <div key={m.id} className="media-item" style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, border: "1px solid var(--border-color)", borderRadius: 8, backgroundColor: "rgba(255,255,255,0.02)", position: "relative" }}>
                        <div
                          onClick={() => setActiveActionMediaId(activeActionMediaId === m.id ? null : m.id)}
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
                        </div>

                        {activeActionMediaId === m.id && (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 12,
                              backgroundColor: "#1e293b",
                              border: "1px solid #334155",
                              borderRadius: 6,
                              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                              zIndex: 100,
                              display: "flex",
                              flexDirection: "column",
                              padding: 6,
                              gap: 4,
                              marginTop: -4,
                              minWidth: 140,
                            }}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActivePreviewMedia(m);
                                setActiveActionMediaId(null);
                              }}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#fff",
                                padding: "6px 8px",
                                textAlign: "left",
                                cursor: "pointer",
                                borderRadius: 4,
                                fontSize: 12,
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)"}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(m);
                                setActiveActionMediaId(null);
                              }}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#fff",
                                padding: "6px 8px",
                                textAlign: "left",
                                cursor: "pointer",
                                borderRadius: 4,
                                fontSize: 12,
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)"}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                            >
                              Download
                            </button>
                          </div>
                        )}
                        
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
                  multiple
                  onChange={async (e) => {
                    const selectedFiles = e.target.files;
                    if (!selectedFiles || selectedFiles.length === 0) return;

                    setMediaLoading(true);
                    try {
                      for (let i = 0; i < selectedFiles.length; i++) {
                        const formData = new FormData();
                        formData.append("file", selectedFiles[i]);
                        await httpClient.post(`/items/${taskId}/media`, formData, {
                          params: { planId },
                          headers: { "Content-Type": "multipart/form-data" },
                        });
                      }
                      await fetchMedia();
                    } catch (err) {
                      console.error("Failed to upload file attachments:", err);
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
                  {media.length === 0 ? "Upload File" : "+ Add More"}
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
