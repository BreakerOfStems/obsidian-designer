import { UIDocument } from "../types/ui-schema";

/**
 * Represents a snapshot of the document state
 */
export interface HistorySnapshot {
  timestamp: number;
  description: string;
  documentJson: string;
}

/**
 * Manages undo/redo history using document snapshots.
 * This approach is simpler and more reliable than tracking individual changes.
 */
export class HistoryManager {
  private undoStack: HistorySnapshot[] = [];
  private redoStack: HistorySnapshot[] = [];
  private maxHistorySize: number = 50;
  private currentDocumentJson: string = "";
  private pendingDescription: string = "Change";
  private batchDepth: number = 0;
  private batchStartJson: string = "";

  /**
   * Set the current document state (call this when document is loaded)
   */
  setCurrentState(doc: UIDocument): void {
    this.currentDocumentJson = JSON.stringify(doc);
  }

  /**
   * Call before making a change to capture the "before" state.
   * Use description to identify what action is being performed.
   */
  beginChange(description: string = "Change"): void {
    this.pendingDescription = description;
    // If not in a batch, the current state becomes the undo point
  }

  /**
   * Start a batch of changes that should be undone as a single action.
   * Call endBatch() when done. Batches can be nested.
   */
  startBatch(description: string = "Change"): void {
    if (this.batchDepth === 0) {
      this.batchStartJson = this.currentDocumentJson;
      this.pendingDescription = description;
    }
    this.batchDepth++;
  }

  /**
   * End a batch of changes
   */
  endBatch(doc: UIDocument): void {
    if (this.batchDepth > 0) {
      this.batchDepth--;
      if (this.batchDepth === 0) {
        const newJson = JSON.stringify(doc);
        // Only push to history if something actually changed
        if (newJson !== this.batchStartJson) {
          this.pushSnapshot(this.batchStartJson, this.pendingDescription);
          this.currentDocumentJson = newJson;
        }
        this.batchStartJson = "";
      }
    }
  }

  /**
   * Call after making a change to record it in history.
   * Pass the new document state.
   */
  commitChange(doc: UIDocument, description?: string): void {
    // If we're in a batch, don't commit individual changes
    if (this.batchDepth > 0) {
      return;
    }

    const newJson = JSON.stringify(doc);

    // Only push to history if something actually changed
    if (newJson !== this.currentDocumentJson) {
      this.pushSnapshot(
        this.currentDocumentJson,
        description || this.pendingDescription
      );
      this.currentDocumentJson = newJson;
    }
  }

  /**
   * Undo the last action.
   * Returns the document state to restore, or null if nothing to undo.
   */
  undo(currentDoc: UIDocument): UIDocument | null {
    const snapshot = this.undoStack.pop();
    if (!snapshot) return null;

    // Push current state to redo stack
    this.redoStack.push({
      timestamp: Date.now(),
      description: snapshot.description,
      documentJson: JSON.stringify(currentDoc),
    });

    // Restore the snapshot
    const restoredDoc = JSON.parse(snapshot.documentJson) as UIDocument;
    this.currentDocumentJson = snapshot.documentJson;

    return restoredDoc;
  }

  /**
   * Redo the last undone action.
   * Returns the document state to restore, or null if nothing to redo.
   */
  redo(currentDoc: UIDocument): UIDocument | null {
    const snapshot = this.redoStack.pop();
    if (!snapshot) return null;

    // Push current state to undo stack
    this.undoStack.push({
      timestamp: Date.now(),
      description: snapshot.description,
      documentJson: JSON.stringify(currentDoc),
    });

    // Restore the snapshot
    const restoredDoc = JSON.parse(snapshot.documentJson) as UIDocument;
    this.currentDocumentJson = snapshot.documentJson;

    return restoredDoc;
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
    this.batchDepth = 0;
    this.batchStartJson = "";
  }

  /**
   * Get undo stack size (for debugging)
   */
  getUndoStackSize(): number {
    return this.undoStack.length;
  }

  /**
   * Get redo stack size (for debugging)
   */
  getRedoStackSize(): number {
    return this.redoStack.length;
  }

  private pushSnapshot(documentJson: string, description: string): void {
    this.undoStack.push({
      timestamp: Date.now(),
      description,
      documentJson,
    });

    // Clear redo stack when a new action is performed
    this.redoStack = [];

    // Limit history size
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }
  }
}
