import { UINode, AbsoluteLayout } from "../types/ui-schema";
import { EditorState } from "../state/EditorState";

/**
 * Clipboard data model for storing copied UI components
 */
export interface ClipboardPayload {
  schemaVersion: number;
  copiedAt: string;
  sourceDocumentId: string;
  nodes: UINode[];
  rootNodeIds: string[];
  boundingBox: BoundingBox;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Manages clipboard operations for UI components
 */
export class ClipboardService {
  private clipboard: ClipboardPayload | null = null;
  private state: EditorState;
  private gridStep: number = 10;
  private maxOverlapAttempts: number = 10;

  constructor(state: EditorState) {
    this.state = state;
  }

  /**
   * Copy selected nodes to clipboard
   * Returns true if any nodes were copied
   */
  copy(): boolean {
    const selectedIds = this.state.getSelectedNodeIds();
    if (selectedIds.length === 0) {
      return false;
    }

    // Get selected nodes and their children (deep copy)
    const nodesToCopy: UINode[] = [];
    const rootNodeIds: string[] = [];

    for (const id of selectedIds) {
      const node = this.state.findNodeById(id);
      if (node && node.id !== "root") {
        // Deep clone the node
        const clonedNode = this.deepCloneNode(node);
        nodesToCopy.push(clonedNode);
        rootNodeIds.push(clonedNode.id);
      }
    }

    if (nodesToCopy.length === 0) {
      return false;
    }

    // Calculate bounding box
    const boundingBox = this.calculateBoundingBox(nodesToCopy);

    // Get source document ID
    const doc = this.state.getDocument();
    const sourceDocumentId = doc?.name || "unknown";

    // Create clipboard payload
    this.clipboard = {
      schemaVersion: 1,
      copiedAt: new Date().toISOString(),
      sourceDocumentId,
      nodes: nodesToCopy,
      rootNodeIds,
      boundingBox,
    };

    // Optionally copy to system clipboard as JSON
    this.copyToSystemClipboard(this.clipboard);

    return true;
  }

  /**
   * Paste nodes from clipboard at the specified cursor position
   * Returns array of pasted node IDs, or null if paste failed
   */
  paste(cursorX: number, cursorY: number): string[] | null {
    if (!this.clipboard || this.clipboard.nodes.length === 0) {
      return null;
    }

    const screen = this.state.getCurrentScreen();
    if (!screen) {
      return null;
    }

    // Calculate translation delta
    // Anchor point is top-left of bounding box
    const anchor = {
      x: this.clipboard.boundingBox.minX,
      y: this.clipboard.boundingBox.minY,
    };

    let deltaX = cursorX - anchor.x;
    let deltaY = cursorY - anchor.y;

    // Generate new IDs for all nodes
    const idMapping = new Map<string, string>();
    const pastedNodes: UINode[] = [];

    for (const node of this.clipboard.nodes) {
      const newNode = this.cloneWithNewIds(node, idMapping);
      pastedNodes.push(newNode);
    }

    // Apply translation to all nodes
    for (const node of pastedNodes) {
      this.translateNode(node, deltaX, deltaY);
    }

    // Calculate new bounding box after translation
    let newBoundingBox = this.calculateBoundingBox(pastedNodes);

    // Check for overlap with original nodes and apply offset if needed
    const originalBoundingBox = this.clipboard.boundingBox;
    let attempts = 0;

    while (
      attempts < this.maxOverlapAttempts &&
      this.boundingBoxesOverlap(newBoundingBox, originalBoundingBox)
    ) {
      // Apply diagonal nudge
      const nudgeX = this.snapToGrid(this.gridStep);
      const nudgeY = this.snapToGrid(this.gridStep);

      for (const node of pastedNodes) {
        this.translateNode(node, nudgeX, nudgeY);
      }

      newBoundingBox = this.calculateBoundingBox(pastedNodes);
      attempts++;
    }

    // Determine parent for pasted nodes
    const parentId = this.determineParent(pastedNodes, cursorX, cursorY);

    // Start a batch so all paste operations are one undo step
    const description = `Paste ${pastedNodes.length} component${pastedNodes.length > 1 ? "s" : ""}`;
    this.state.startBatch(description);

    // Add pasted nodes to the document
    const pastedIds: string[] = [];
    for (const node of pastedNodes) {
      this.state.addNode(node, parentId, description);
      pastedIds.push(node.id);
    }

    // End the batch
    this.state.endBatch();

    // Select the newly pasted nodes
    this.state.clearSelection();
    for (const id of pastedIds) {
      this.state.selectNode(id, true);
    }

    return pastedIds;
  }

  /**
   * Duplicate selected nodes with a fixed offset (no cursor position needed)
   * Returns array of duplicated node IDs, or null if duplication failed
   */
  duplicate(): string[] | null {
    // First copy the selection
    if (!this.copy()) {
      return null;
    }

    // Calculate offset position (fixed offset from original)
    const boundingBox = this.clipboard!.boundingBox;
    const offsetX = boundingBox.minX + this.gridStep * 2;
    const offsetY = boundingBox.minY + this.gridStep * 2;

    return this.paste(offsetX, offsetY);
  }

  /**
   * Check if clipboard has content
   */
  hasContent(): boolean {
    return this.clipboard !== null && this.clipboard.nodes.length > 0;
  }

  /**
   * Get the current clipboard content (for debugging/inspection)
   */
  getClipboard(): ClipboardPayload | null {
    return this.clipboard;
  }

  /**
   * Set grid step for overlap avoidance
   */
  setGridStep(step: number): void {
    this.gridStep = Math.max(1, step);
  }

  /**
   * Deep clone a node and all its children
   */
  private deepCloneNode(node: UINode): UINode {
    return JSON.parse(JSON.stringify(node));
  }

  /**
   * Clone a node with new unique IDs, recursively updating all references
   */
  private cloneWithNewIds(node: UINode, idMapping: Map<string, string>): UINode {
    const cloned = this.deepCloneNode(node);
    this.regenerateIds(cloned, idMapping);
    return cloned;
  }

  /**
   * Recursively regenerate IDs for a node and all its children
   */
  private regenerateIds(node: UINode, idMapping: Map<string, string>): void {
    const oldId = node.id;
    const newId = this.generateId();

    idMapping.set(oldId, newId);
    node.id = newId;

    // Update children recursively
    if (node.children) {
      for (const child of node.children) {
        this.regenerateIds(child, idMapping);
      }
    }

    // Update any meta references that point to nodes in the pasted set
    if (node.meta?.related) {
      node.meta.related = node.meta.related.map((ref) => {
        const mappedId = idMapping.get(ref);
        return mappedId || ref;
      });
    }
  }

  /**
   * Generate a unique node ID
   */
  private generateId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate bounding box for a set of nodes
   */
  private calculateBoundingBox(nodes: UINode[]): BoundingBox {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of nodes) {
      const bounds = this.getNodeBounds(node);
      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    }

    return { minX, minY, maxX, maxY };
  }

  /**
   * Get the bounding box of a single node (including children)
   */
  private getNodeBounds(node: UINode, offsetX = 0, offsetY = 0): BoundingBox {
    if (node.layout.mode !== "absolute") {
      return { minX: offsetX, minY: offsetY, maxX: offsetX, maxY: offsetY };
    }

    const layout = node.layout as AbsoluteLayout;
    const nodeX = offsetX + layout.x;
    const nodeY = offsetY + layout.y;

    let minX = nodeX;
    let minY = nodeY;
    let maxX = nodeX + layout.w;
    let maxY = nodeY + layout.h;

    // Include children in bounding box
    if (node.children) {
      for (const child of node.children) {
        const childBounds = this.getNodeBounds(child, nodeX, nodeY);
        minX = Math.min(minX, childBounds.minX);
        minY = Math.min(minY, childBounds.minY);
        maxX = Math.max(maxX, childBounds.maxX);
        maxY = Math.max(maxY, childBounds.maxY);
      }
    }

    return { minX, minY, maxX, maxY };
  }

  /**
   * Translate a node's position by a delta amount
   */
  private translateNode(node: UINode, deltaX: number, deltaY: number): void {
    if (node.layout.mode === "absolute") {
      const layout = node.layout as AbsoluteLayout;
      layout.x += deltaX;
      layout.y += deltaY;
    }
    // Note: Children with absolute layout are relative to parent, so we don't translate them
  }

  /**
   * Check if two bounding boxes overlap
   */
  private boundingBoxesOverlap(box1: BoundingBox, box2: BoundingBox): boolean {
    return !(
      box1.maxX <= box2.minX ||
      box1.minX >= box2.maxX ||
      box1.maxY <= box2.minY ||
      box1.minY >= box2.maxY
    );
  }

  /**
   * Snap a value to the grid
   */
  private snapToGrid(value: number): number {
    return Math.round(value / this.gridStep) * this.gridStep;
  }

  /**
   * Determine the parent node for pasted nodes based on context
   */
  private determineParent(
    _pastedNodes: UINode[],
    _cursorX: number,
    _cursorY: number
  ): string | undefined {
    // Default behavior: add to root
    // Future enhancement: detect container under cursor or use original parent
    const screen = this.state.getCurrentScreen();
    return screen?.root.id;
  }

  /**
   * Copy clipboard data to system clipboard as JSON
   */
  private async copyToSystemClipboard(payload: ClipboardPayload): Promise<void> {
    try {
      const json = JSON.stringify(payload);
      await navigator.clipboard.writeText(json);
    } catch (e) {
      // Silently fail if clipboard API is not available
      console.debug("Could not copy to system clipboard:", e);
    }
  }

  /**
   * Clear the internal clipboard
   */
  clear(): void {
    this.clipboard = null;
  }
}
