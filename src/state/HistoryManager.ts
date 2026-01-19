import { UINode } from "../types/ui-schema";
import { EditorState } from "./EditorState";

/**
 * Represents a single undoable action
 */
export interface HistoryEntry {
  type: "add" | "remove" | "update";
  timestamp: number;
  description: string;
  /**
   * Data needed to undo this action
   */
  undoData: {
    nodeIds: string[];
    nodes?: UINode[];
    parentIds?: (string | undefined)[];
    previousState?: Map<string, UINode>;
  };
  /**
   * Data needed to redo this action
   */
  redoData: {
    nodeIds: string[];
    nodes?: UINode[];
    parentIds?: (string | undefined)[];
    newState?: Map<string, UINode>;
  };
}

/**
 * Manages undo/redo history for the editor
 */
export class HistoryManager {
  private state: EditorState;
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private maxHistorySize: number = 50;
  private isApplyingHistory: boolean = false;

  constructor(state: EditorState) {
    this.state = state;
  }

  /**
   * Record adding nodes (for undo, we remove them)
   */
  recordAdd(
    nodes: UINode[],
    parentIds: (string | undefined)[],
    description: string = "Add nodes"
  ): void {
    if (this.isApplyingHistory) return;

    const entry: HistoryEntry = {
      type: "add",
      timestamp: Date.now(),
      description,
      undoData: {
        nodeIds: nodes.map((n) => n.id),
      },
      redoData: {
        nodeIds: nodes.map((n) => n.id),
        nodes: nodes.map((n) => this.deepClone(n)),
        parentIds: [...parentIds],
      },
    };

    this.pushEntry(entry);
  }

  /**
   * Record removing nodes (for undo, we add them back)
   */
  recordRemove(
    nodes: UINode[],
    parentIds: (string | undefined)[],
    description: string = "Remove nodes"
  ): void {
    if (this.isApplyingHistory) return;

    const entry: HistoryEntry = {
      type: "remove",
      timestamp: Date.now(),
      description,
      undoData: {
        nodeIds: nodes.map((n) => n.id),
        nodes: nodes.map((n) => this.deepClone(n)),
        parentIds: [...parentIds],
      },
      redoData: {
        nodeIds: nodes.map((n) => n.id),
      },
    };

    this.pushEntry(entry);
  }

  /**
   * Undo the last action
   * Returns true if undo was successful
   */
  undo(): boolean {
    const entry = this.undoStack.pop();
    if (!entry) return false;

    this.isApplyingHistory = true;

    try {
      switch (entry.type) {
        case "add":
          // Undo add = remove the nodes
          for (const nodeId of entry.undoData.nodeIds) {
            this.state.removeNode(nodeId);
          }
          break;

        case "remove":
          // Undo remove = add the nodes back
          if (entry.undoData.nodes && entry.undoData.parentIds) {
            for (let i = 0; i < entry.undoData.nodes.length; i++) {
              const node = this.deepClone(entry.undoData.nodes[i]);
              const parentId = entry.undoData.parentIds[i];
              this.state.addNode(node, parentId);
            }
          }
          break;
      }

      this.redoStack.push(entry);
      return true;
    } finally {
      this.isApplyingHistory = false;
    }
  }

  /**
   * Redo the last undone action
   * Returns true if redo was successful
   */
  redo(): boolean {
    const entry = this.redoStack.pop();
    if (!entry) return false;

    this.isApplyingHistory = true;

    try {
      switch (entry.type) {
        case "add":
          // Redo add = add the nodes
          if (entry.redoData.nodes && entry.redoData.parentIds) {
            for (let i = 0; i < entry.redoData.nodes.length; i++) {
              const node = this.deepClone(entry.redoData.nodes[i]);
              const parentId = entry.redoData.parentIds[i];
              this.state.addNode(node, parentId);
            }
          }
          break;

        case "remove":
          // Redo remove = remove the nodes
          for (const nodeId of entry.redoData.nodeIds) {
            this.state.removeNode(nodeId);
          }
          break;
      }

      this.undoStack.push(entry);
      return true;
    } finally {
      this.isApplyingHistory = false;
    }
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get the description of the next undo action
   */
  getUndoDescription(): string | null {
    const entry = this.undoStack[this.undoStack.length - 1];
    return entry?.description ?? null;
  }

  /**
   * Get the description of the next redo action
   */
  getRedoDescription(): string | null {
    const entry = this.redoStack[this.redoStack.length - 1];
    return entry?.description ?? null;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Check if we're currently applying history (to avoid recording during undo/redo)
   */
  isApplying(): boolean {
    return this.isApplyingHistory;
  }

  private pushEntry(entry: HistoryEntry): void {
    this.undoStack.push(entry);

    // Clear redo stack when a new action is performed
    this.redoStack = [];

    // Limit history size
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}
