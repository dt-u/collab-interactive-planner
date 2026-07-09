import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";

export interface CanvasElement {
  id: string;
  type: "path" | "text" | "rectangle" | "ellipse" | "arrow" | "line";
  x: number;
  y: number;
  width?: number;
  height?: number;
  color: string;
  strokeWidth: number;
  fill?: boolean;
  textData?: string;
  points?: number[]; // [x1, y1, x2, y2, ...] flat coordinates for paths
}

export type ActiveToolType =
  | "select"
  | "brush"
  | "eraser"
  | "text"
  | "rect_rect"
  | "rect_fill"
  | "ellipse_rect"
  | "ellipse_fill"
  | "line"
  | "arrow_line";

export function useDrawingPaths(
  yDoc: Y.Doc | null,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  activeTool: ActiveToolType,
  brushColor: string,
  brushSize: number
) {
  const [elementsVersion, setElementsVersion] = useState(0);
  const [currentPreviewElement, setCurrentPreviewElement] = useState<CanvasElement | null>(null);

  const yjsElementsRef = useRef<Map<string, CanvasElement>>(new Map());
  const activePreviewElementRef = useRef<CanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const activeElementIdRef = useRef<string | null>(null);

  // Synchronize Yjs canvasElements Shared Map with local ref cache
  useEffect(() => {
    if (!yDoc) return;
    const yjsElements = yDoc.getMap<CanvasElement>("canvasElements");

    const handleUpdate = () => {
      const newMap = new Map<string, CanvasElement>();
      yjsElements.forEach((val, key) => {
        newMap.set(key, val);
      });
      yjsElementsRef.current = newMap;
      setElementsVersion((v) => v + 1);
    };

    handleUpdate();
    yjsElements.observe(handleUpdate);
    return () => {
      yjsElements.unobserve(handleUpdate);
    };
  }, [yDoc]);

  // RequestAnimationFrame graphics drawing loop running at 60fps
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const drawElement = (el: CanvasElement) => {
        ctx.strokeStyle = el.color;
        ctx.fillStyle = el.color;
        ctx.lineWidth = el.strokeWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        switch (el.type) {
          case "rectangle":
            if (el.fill) {
              ctx.fillRect(el.x, el.y, el.width ?? 0, el.height ?? 0);
            } else {
              ctx.strokeRect(el.x, el.y, el.width ?? 0, el.height ?? 0);
            }
            break;

          case "ellipse":
            ctx.beginPath();
            const rx = (el.width ?? 0) / 2;
            const ry = (el.height ?? 0) / 2;
            const cx = el.x + rx;
            const cy = el.y + ry;
            ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, 2 * Math.PI);
            if (el.fill) {
              ctx.fill();
            } else {
              ctx.stroke();
            }
            break;

          case "arrow":
            const startX = el.x;
            const startY = el.y;
            const endX = el.x + (el.width ?? 0);
            const endY = el.y + (el.height ?? 0);

            // Draw arrow shaft line
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            // Render arrow head pointer
            const angle = Math.atan2(endY - startY, endX - startX);
            const arrowLength = Math.max(12, el.strokeWidth * 3);
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(
              endX - arrowLength * Math.cos(angle - Math.PI / 6),
              endY - arrowLength * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
              endX - arrowLength * Math.cos(angle + Math.PI / 6),
              endY - arrowLength * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();
            break;

          case "line":
            ctx.beginPath();
            ctx.moveTo(el.x, el.y);
            ctx.lineTo(el.x + (el.width ?? 0), el.y + (el.height ?? 0));
            ctx.stroke();
            break;

          case "text":
            ctx.font = `${el.strokeWidth * 3 + 14}px sans-serif`;
            ctx.textBaseline = "top";
            ctx.fillText(el.textData ?? "", el.x, el.y);
            break;

          case "path":
            if (el.points && el.points.length >= 4) {
              ctx.beginPath();
              ctx.moveTo(el.points[0], el.points[1]);
              for (let i = 2; i < el.points.length; i += 2) {
                ctx.lineTo(el.points[i], el.points[i + 1]);
              }
              ctx.stroke();
            }
            break;
        }
      };

      // Draw all confirmed canvas elements
      yjsElementsRef.current.forEach((el) => {
        drawElement(el);
      });

      // Draw active preview stroke/shape
      const preview = activePreviewElementRef.current;
      if (preview) {
        drawElement(preview);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [canvasRef]);

  // AABB-filtered vector eraser checks
  const eraseAtPoint = useCallback(
    (x: number, y: number) => {
      if (!yDoc) return;
      const yjsElements = yDoc.getMap<CanvasElement>("canvasElements");
      const radius = brushSize * 2;

      yjsElements.forEach((el, id) => {
        let xmin = el.x;
        let ymin = el.y;
        let xmax = el.x + (el.width ?? 0);
        let ymax = el.y + (el.height ?? 0);

        if (el.type === "arrow" || el.type === "line") {
          xmin = Math.min(el.x, el.x + (el.width ?? 0));
          xmax = Math.max(el.x, el.x + (el.width ?? 0));
          ymin = Math.min(el.y, el.y + (el.height ?? 0));
          ymax = Math.max(el.y, el.y + (el.height ?? 0));
        }

        // Bounding box collision pre-filter check
        if (
          x + radius < xmin ||
          x - radius > xmax ||
          y + radius < ymin ||
          y - radius > ymax
        ) {
          return;
        }

        // Granular check for brush paths
        if (el.type === "path" && el.points) {
          let hit = false;
          for (let i = 0; i < el.points.length; i += 2) {
            const px = el.points[i];
            const py = el.points[i + 1];
            const dx = px - x;
            const dy = py - y;
            if (dx * dx + dy * dy <= radius * radius) {
              hit = true;
              break;
            }
          }
          if (hit) {
            yjsElements.delete(id);
          }
        } else {
          // Precise match for shapes/arrows/texts falls within bounds
          yjsElements.delete(id);
        }
      });
    },
    [yDoc, brushSize]
  );

  const startDrawing = useCallback(
    (x: number, y: number) => {
      if (activeTool === "select") return;
      isDrawingRef.current = true;
      startPointRef.current = { x, y };

      const elementId = `el_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      activeElementIdRef.current = elementId;

      if (activeTool === "brush") {
        const newEl: CanvasElement = {
          id: elementId,
          type: "path",
          x,
          y,
          color: brushColor,
          strokeWidth: brushSize,
          points: [x, y],
          width: 0,
          height: 0,
        };
        activePreviewElementRef.current = newEl;
        setCurrentPreviewElement(newEl);
      } else if (activeTool === "eraser") {
        eraseAtPoint(x, y);
      } else if (activeTool === "text") {
        // Handled at KanbanBoard component level by spawning textareas
        isDrawingRef.current = false;
      } else {
        // Shapes and arrow tools initial preview placement
        const type =
          activeTool === "arrow_line"
            ? "arrow"
            : activeTool === "line"
            ? "line"
            : activeTool.startsWith("ellipse")
            ? "ellipse"
            : "rectangle";

        const fill = activeTool.endsWith("_fill");

        const newEl: CanvasElement = {
          id: elementId,
          type,
          x,
          y,
          width: 0,
          height: 0,
          color: brushColor,
          strokeWidth: brushSize,
          fill,
        };
        activePreviewElementRef.current = newEl;
        setCurrentPreviewElement(newEl);
      }
    },
    [activeTool, brushColor, brushSize, eraseAtPoint]
  );

  const drawMove = useCallback(
    (x: number, y: number) => {
      if (!isDrawingRef.current) return;

      if (activeTool === "brush" && activePreviewElementRef.current) {
        const points = [...(activePreviewElementRef.current.points || []), x, y];
        // Recalculate bounding dimensions
        const xCoords = points.filter((_, idx) => idx % 2 === 0);
        const yCoords = points.filter((_, idx) => idx % 2 !== 0);
        const xmin = Math.min(...xCoords);
        const ymin = Math.min(...yCoords);
        const xmax = Math.max(...xCoords);
        const ymax = Math.max(...yCoords);

        const updated: CanvasElement = {
          ...activePreviewElementRef.current,
          x: xmin,
          y: ymin,
          width: xmax - xmin,
          height: ymax - ymin,
          points,
        };
        activePreviewElementRef.current = updated;
        setCurrentPreviewElement(updated);
      } else if (activeTool === "eraser") {
        eraseAtPoint(x, y);
      } else if (startPointRef.current && activePreviewElementRef.current) {
        const start = startPointRef.current;
        const dx = x - start.x;
        const dy = y - start.y;

        if (
          activePreviewElementRef.current.type === "arrow" ||
          activePreviewElementRef.current.type === "line"
        ) {
          const updated: CanvasElement = {
            ...activePreviewElementRef.current,
            width: dx,
            height: dy,
          };
          activePreviewElementRef.current = updated;
          setCurrentPreviewElement(updated);
        } else {
          // Rectangles and Ellipses dimensions calculations
          const xmin = Math.min(start.x, x);
          const ymin = Math.min(start.y, y);
          const width = Math.abs(dx);
          const height = Math.abs(dy);

          const updated: CanvasElement = {
            ...activePreviewElementRef.current,
            x: xmin,
            y: ymin,
            width,
            height,
          };
          activePreviewElementRef.current = updated;
          setCurrentPreviewElement(updated);
        }
      }
    },
    [activeTool, eraseAtPoint]
  );

  const endDrawing = useCallback(() => {
    isDrawingRef.current = false;
    if (activePreviewElementRef.current && activeElementIdRef.current && yDoc) {
      const yjsElements = yDoc.getMap<CanvasElement>("canvasElements");
      yjsElements.set(activeElementIdRef.current, activePreviewElementRef.current);
    }
    activePreviewElementRef.current = null;
    setCurrentPreviewElement(null);
    startPointRef.current = null;
    activeElementIdRef.current = null;
  }, [yDoc]);

  return {
    startDrawing,
    drawMove,
    endDrawing,
    elementsVersion,
    currentPreviewElement,
  };
}
