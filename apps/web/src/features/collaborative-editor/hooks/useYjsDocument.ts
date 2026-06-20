import { useEffect, useState, useCallback, useRef } from "react";
import * as Y from "yjs";
import {
  getSharedItems,
  getSharedColumns,
  getSharedColumnOrder,
  getSharedColumnMetadata,
  YJS_KEYS,
  YjsPlannerItem,
} from "@collab-planner/yjs-utils";

export interface TaskState {
  id: string;
  title: string;
  description: string;
  status: string; // maps to dynamic columnId/dayId
  assignees: string[];
  time?: string;
  cost?: string;
  image?: string;
}

export interface ColumnMetadata {
  id: string;
  title: string;
  date?: string;
}

/**
 * Hook to manage reactive Yjs task document updates at card level.
 * Subscribes only to changes in the specific task to prevent board-wide re-renders.
 */
export function useYjsDocument(yDoc: Y.Doc | undefined, taskId: string) {
  const [task, setTask] = useState<TaskState | null>(null);

  useEffect(() => {
    if (!yDoc) return;

    const itemsMap = getSharedItems(yDoc);
    
    const getTaskFromMap = (map: Y.Map<any> | undefined): TaskState | null => {
      if (!map) return null;
      return {
        id: taskId,
        title: map.get("title") || "",
        description: map.get("description") || "",
        status: map.get("status") || "",
        assignees: map.get("assignees") || [],
        time: map.get("time") || "",
        cost: map.get("cost") || "",
        image: map.get("image") || "",
      };
    };

    // Initialize state
    const currentMap = itemsMap.get(taskId) as Y.Map<any> | undefined;
    setTask(getTaskFromMap(currentMap));

    const handleTaskChange = () => {
      const updatedMap = itemsMap.get(taskId) as Y.Map<any> | undefined;
      setTask(getTaskFromMap(updatedMap));
    };

    // 1. Listen to mutations inside this specific task's Map
    let taskMapObserver: (() => void) | null = null;
    
    const setupTaskMapObserver = (map: Y.Map<any>) => {
      if (taskMapObserver) return;
      taskMapObserver = () => {
        handleTaskChange();
      };
      map.observe(taskMapObserver);
    };

    if (currentMap) {
      setupTaskMapObserver(currentMap);
    }

    // 2. Listen to additions/removals of the task itself in the items collection
    const itemsObserver = (event: Y.YMapEvent<any>) => {
      if (event.keysChanged.has(taskId)) {
        const newMap = itemsMap.get(taskId) as Y.Map<any> | undefined;
        if (newMap) {
          setupTaskMapObserver(newMap);
        } else {
          taskMapObserver = null;
        }
        handleTaskChange();
      }
    };

    itemsMap.observe(itemsObserver);

    return () => {
      itemsMap.unobserve(itemsObserver);
      if (taskMapObserver && currentMap) {
        currentMap.unobserve(taskMapObserver);
      }
    };
  }, [yDoc, taskId]);

  // Update properties of the task
  const updateTask = useCallback(
    (updates: Partial<Omit<TaskState, "id">>) => {
      if (!yDoc) return;
      const itemsMap = getSharedItems(yDoc);
      const itemMap = itemsMap.get(taskId) as Y.Map<any> | undefined;
      if (!itemMap) return;

      yDoc.transact(() => {
        Object.entries(updates).forEach(([key, value]) => {
          itemMap.set(key, value);
        });
      });
    },
    [yDoc, taskId]
  );

  return { task, updateTask };
}

/**
 * Hook to manage reactive board columns with Mutation Lock Guard support.
 * Subscribes to changes in columns layout and metadata.
 */
export function useYjsColumns(yDoc: Y.Doc | undefined, isDraggingLocal: boolean) {
  const [columns, setColumns] = useState<Record<string, string[]>>({});
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnMetadata, setColumnMetadata] = useState<Record<string, ColumnMetadata>>({});

  const bufferedColumns = useRef<{
    columns: Record<string, string[]>;
    columnOrder: string[];
    columnMetadata: Record<string, ColumnMetadata>;
  } | null>(null);

  useEffect(() => {
    if (!yDoc) return;

    const columnsMap = getSharedColumns(yDoc);
    const orderArray = getSharedColumnOrder(yDoc);
    const metadataMap = getSharedColumnMetadata(yDoc);

    const syncState = () => {
      const nextColumns: Record<string, string[]> = {};
      columnsMap.forEach((array, key) => {
        nextColumns[key] = array.toArray();
      });

      const nextOrder = orderArray.toArray();

      const nextMetadata: Record<string, ColumnMetadata> = {};
      metadataMap.forEach((val: any, key) => {
        nextMetadata[key] = val;
      });

      const updatedState = {
        columns: nextColumns,
        columnOrder: nextOrder,
        columnMetadata: nextMetadata,
      };

      if (isDraggingLocal) {
        bufferedColumns.current = updatedState;
      } else {
        setColumns(nextColumns);
        setColumnOrder(nextOrder);
        setColumnMetadata(nextMetadata);
        bufferedColumns.current = null;
      }
    };

    if (!isDraggingLocal && bufferedColumns.current) {
      setColumns(bufferedColumns.current.columns);
      setColumnOrder(bufferedColumns.current.columnOrder);
      setColumnMetadata(bufferedColumns.current.columnMetadata);
      bufferedColumns.current = null;
    } else if (Object.keys(columns).length === 0) {
      // Run initial load
      syncState();
    }

    const observer = () => {
      syncState();
    };

    columnsMap.observeDeep(observer);
    orderArray.observe(observer);
    metadataMap.observe(observer);

    return () => {
      columnsMap.unobserveDeep(observer);
      orderArray.unobserve(observer);
      metadataMap.unobserve(observer);
    };
  }, [yDoc, isDraggingLocal]);

  return { columns, columnOrder, columnMetadata };
}
