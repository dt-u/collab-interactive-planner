import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";

export interface PathPoint {
  x: number;
  y: number;
}

export interface DrawingPath {
  id: string;
  points: PathPoint[];
  color: string;
  width: number;
  aabb: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
}

export function useDrawingPaths(
  yDoc: Y.Doc | null,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  activeTool: "select" | "brush" | "eraser",
  brushColor: string,
  brushSize: number
) {
  const [pathsVersion, setPathsVersion] = useState(0);
  const yjsPathsRef = useRef<DrawingPath[]>([]);
  const activePathRef = useRef<DrawingPath | null>(null);
  const isDrawingRef = useRef(false);

  // Synchronize Yjs paths with ref cache
  useEffect(() => {
    if (!yDoc) return;
    const yjsPaths = yDoc.getArray<DrawingPath>("drawingPaths");

    const handleUpdate = () => {
      yjsPathsRef.current = yjsPaths.toArray();
      setPathsVersion((v) => v + 1);
    };

    handleUpdate();
    yjsPaths.observe(handleUpdate);
    return () => {
      yjsPaths.unobserve(handleUpdate);
    };
  }, [yDoc]);

  // RequestAnimationFrame drawing loop running at native 60fps
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

      // Render all completed drawing paths
      const paths = yjsPathsRef.current;
      paths.forEach((path) => {
        if (!path.points || path.points.length === 0) return;
        ctx.beginPath();
        ctx.strokeStyle = path.color;
        ctx.lineWidth = path.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) {
          ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        ctx.stroke();
      });

      // Render active local stroke
      const current = activePathRef.current;
      if (current && current.points.length > 0) {
        ctx.beginPath();
        ctx.strokeStyle = current.color;
        ctx.lineWidth = current.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.moveTo(current.points[0].x, current.points[0].y);
        for (let i = 1; i < current.points.length; i++) {
          ctx.lineTo(current.points[i].x, current.points[i].y);
        }
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [canvasRef]);

  // AABB Collision pre-filtering for O(1) erasure execution
  const eraseAtPoint = useCallback(
    (x: number, y: number) => {
      if (!yDoc) return;
      const yjsPaths = yDoc.getArray<DrawingPath>("drawingPaths");
      const radius = brushSize * 1.5;

      for (let i = yjsPaths.length - 1; i >= 0; i--) {
        const path = yjsPaths.get(i);
        if (!path) continue;

        // Bounding rect pre-filter check
        if (
          x + radius < path.aabb.xmin ||
          x - radius > path.aabb.xmax ||
          y + radius < path.aabb.ymin ||
          y - radius > path.aabb.ymax
        ) {
          continue;
        }

        // Granular distance comparison
        const hit = path.points.some((p) => {
          const dx = p.x - x;
          const dy = p.y - y;
          return dx * dx + dy * dy <= radius * radius;
        });

        if (hit) {
          yjsPaths.delete(i, 1);
        }
      }
    },
    [yDoc, brushSize]
  );

  const startDrawing = useCallback(
    (x: number, y: number) => {
      if (activeTool === "select") return;
      isDrawingRef.current = true;

      if (activeTool === "brush") {
        activePathRef.current = {
          id: Math.random().toString(36).substr(2, 9),
          points: [{ x, y }],
          color: brushColor,
          width: brushSize,
          aabb: { xmin: x, ymin: y, xmax: x, ymax: y },
        };
      } else if (activeTool === "eraser") {
        eraseAtPoint(x, y);
      }
    },
    [activeTool, brushColor, brushSize, eraseAtPoint]
  );

  const drawMove = useCallback(
    (x: number, y: number) => {
      if (!isDrawingRef.current) return;

      if (activeTool === "brush" && activePathRef.current) {
        const points = [...activePathRef.current.points, { x, y }];
        const xCoords = points.map((p) => p.x);
        const yCoords = points.map((p) => p.y);

        activePathRef.current = {
          ...activePathRef.current,
          points,
          aabb: {
            xmin: Math.min(...xCoords),
            ymin: Math.min(...yCoords),
            xmax: Math.max(...xCoords),
            ymax: Math.max(...yCoords),
          },
        };
      } else if (activeTool === "eraser") {
        eraseAtPoint(x, y);
      }
    },
    [activeTool, eraseAtPoint]
  );

  const endDrawing = useCallback(() => {
    isDrawingRef.current = false;
    if (activeTool === "brush" && activePathRef.current && yDoc) {
      const yjsPaths = yDoc.getArray<DrawingPath>("drawingPaths");
      yjsPaths.push([activePathRef.current]);
    }
    activePathRef.current = null;
  }, [activeTool, yDoc]);

  return {
    startDrawing,
    drawMove,
    endDrawing,
    pathsVersion,
  };
}
