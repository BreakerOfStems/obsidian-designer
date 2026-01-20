import { TFile } from "obsidian";
import {
  UIDocument,
  UINode,
  Screen,
  ScreenContract,
  createEmptyDocument,
  createDefaultScreenContract,
  AnchoredLayout,
  anchoredToAbsolute,
} from "../types/ui-schema";
import { HistoryManager } from "./HistoryManager";

type EventCallback = (...args: unknown[]) => void;

export interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
}

export interface EditorStateData {
  document: UIDocument | null;
  file: TFile | null;
  currentScreenId: string | null;
  selectedNodeIds: Set<string>;
  hoveredNodeId: string | null;
  viewport: ViewportState;
  isDirty: boolean;
}

/**
 * Shared state management for the UI Editor
 * Uses a simple event emitter pattern for cross-view updates
 */
export class EditorState {
  private data: EditorStateData;
  private listeners: Map<string, Set<EventCallback>>;
  private historyManager: HistoryManager;

  constructor() {
    this.data = {
      document: null,
      file: null,
      currentScreenId: null,
      selectedNodeIds: new Set(),
      hoveredNodeId: null,
      viewport: { panX: 0, panY: 0, zoom: 1 },
      isDirty: false,
    };
    this.listeners = new Map();
    this.historyManager = new HistoryManager();
  }

  // Event emitter methods
  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((cb) => cb(...args));
  }

  // Document management
  loadDocument(doc: UIDocument, file: TFile): void {
    this.data.document = doc;
    this.data.file = file;
    this.data.isDirty = false;
    this.data.selectedNodeIds.clear();
    this.data.hoveredNodeId = null;

    // Select first screen if available
    const screenIds = Object.keys(doc.screens);
    this.data.currentScreenId = screenIds.length > 0 ? screenIds[0] : null;

    // Initialize history with loaded document
    this.historyManager.clear();
    this.historyManager.setCurrentState(doc);

    this.emit("document-loaded", doc);
    this.emit("selection-changed", []);
  }

  getDocument(): UIDocument | null {
    return this.data.document;
  }

  getFile(): TFile | null {
    return this.data.file;
  }

  createNewDocument(name?: string): UIDocument {
    const doc = createEmptyDocument(name);

    // Create a default screen
    const screenId = "main";
    doc.screens[screenId] = {
      id: screenId,
      name: "Main Screen",
      root: {
        id: "root",
        type: "Container",
        name: "Root",
        layout: {
          mode: "absolute",
          x: 0,
          y: 0,
          w: 375,
          h: 667,
        },
        style: {
          background: "color.background",
        },
        children: [],
      },
    };

    return doc;
  }

  // Screen management
  getCurrentScreen(): Screen | null {
    if (!this.data.document || !this.data.currentScreenId) return null;
    return this.data.document.screens[this.data.currentScreenId] || null;
  }

  setCurrentScreen(screenId: string): void {
    if (this.data.document?.screens[screenId]) {
      this.data.currentScreenId = screenId;
      this.data.selectedNodeIds.clear();
      this.emit("screen-changed", screenId);
      this.emit("selection-changed", []);
    }
  }

  // Node selection
  selectNode(nodeId: string, addToSelection = false): void {
    if (!addToSelection) {
      this.data.selectedNodeIds.clear();
    }
    this.data.selectedNodeIds.add(nodeId);
    this.emit("selection-changed", Array.from(this.data.selectedNodeIds));
  }

  deselectNode(nodeId: string): void {
    this.data.selectedNodeIds.delete(nodeId);
    this.emit("selection-changed", Array.from(this.data.selectedNodeIds));
  }

  clearSelection(): void {
    this.data.selectedNodeIds.clear();
    this.emit("selection-changed", []);
  }

  getSelectedNodeIds(): string[] {
    return Array.from(this.data.selectedNodeIds);
  }

  isNodeSelected(nodeId: string): boolean {
    return this.data.selectedNodeIds.has(nodeId);
  }

  getSelectedNode(): UINode | null {
    const ids = this.getSelectedNodeIds();
    if (ids.length !== 1) return null;
    return this.findNodeById(ids[0]);
  }

  // Node hover
  setHoveredNode(nodeId: string | null): void {
    if (this.data.hoveredNodeId !== nodeId) {
      this.data.hoveredNodeId = nodeId;
      this.emit("hover-changed", nodeId);
    }
  }

  getHoveredNodeId(): string | null {
    return this.data.hoveredNodeId;
  }

  // Viewport
  setViewport(viewport: Partial<ViewportState>): void {
    this.data.viewport = { ...this.data.viewport, ...viewport };
    this.emit("viewport-changed", this.data.viewport);
  }

  getViewport(): ViewportState {
    return { ...this.data.viewport };
  }

  // Find node by ID (recursive search)
  findNodeById(nodeId: string, root?: UINode): UINode | null {
    const searchRoot = root || this.getCurrentScreen()?.root;
    if (!searchRoot) return null;

    if (searchRoot.id === nodeId) return searchRoot;

    if (searchRoot.children) {
      for (const child of searchRoot.children) {
        const found = this.findNodeById(nodeId, child);
        if (found) return found;
      }
    }

    return null;
  }

  // Find parent of a node
  findParentNode(nodeId: string, root?: UINode): UINode | null {
    const searchRoot = root || this.getCurrentScreen()?.root;
    if (!searchRoot || !searchRoot.children) return null;

    for (const child of searchRoot.children) {
      if (child.id === nodeId) return searchRoot;
      const found = this.findParentNode(nodeId, child);
      if (found) return found;
    }

    return null;
  }

  // Collect all nodes flat
  getAllNodes(root?: UINode): UINode[] {
    const searchRoot = root || this.getCurrentScreen()?.root;
    if (!searchRoot) return [];

    const nodes: UINode[] = [searchRoot];
    if (searchRoot.children) {
      for (const child of searchRoot.children) {
        nodes.push(...this.getAllNodes(child));
      }
    }
    return nodes;
  }

  // Batch operations for grouping multiple changes into one undo step
  startBatch(description: string): void {
    this.historyManager.startBatch(description);
  }

  endBatch(): void {
    if (this.data.document) {
      this.historyManager.endBatch(this.data.document);
    }
  }

  // Modification methods
  updateNode(nodeId: string, updates: Partial<UINode>, description: string = "Update node"): void {
    const node = this.findNodeById(nodeId);
    if (!node || !this.data.document) return;

    Object.assign(node, updates);
    this.markDirty();
    this.historyManager.commitChange(this.data.document, description);
    this.emit("node-updated", nodeId, updates);
  }

  updateNodeLayout(
    nodeId: string,
    layout: Partial<UINode["layout"]>,
    description: string = "Move/resize"
  ): void {
    const node = this.findNodeById(nodeId);
    if (!node || !this.data.document) return;

    node.layout = { ...node.layout, ...layout } as UINode["layout"];
    this.markDirty();
    this.historyManager.commitChange(this.data.document, description);
    this.emit("node-updated", nodeId, { layout: node.layout });
  }

  updateNodeStyle(nodeId: string, style: Partial<UINode["style"]>, description: string = "Update style"): void {
    const node = this.findNodeById(nodeId);
    if (!node || !this.data.document) return;

    node.style = { ...node.style, ...style };
    this.markDirty();
    this.historyManager.commitChange(this.data.document, description);
    this.emit("node-updated", nodeId, { style: node.style });
  }

  updateNodeBehavior(nodeId: string, behavior: UINode["behavior"], description: string = "Update behavior"): void {
    const node = this.findNodeById(nodeId);
    if (!node || !this.data.document) return;

    // Set to undefined if the behavior object is empty
    const isEmpty = !behavior || (
      !behavior.events?.length &&
      behavior.enabled === undefined &&
      behavior.interactionMode === undefined &&
      !behavior.animations?.length
    );
    node.behavior = isEmpty ? undefined : behavior;
    this.markDirty();
    this.historyManager.commitChange(this.data.document, description);
    this.emit("node-updated", nodeId, { behavior: node.behavior });
  }

  updateNodeBinding(nodeId: string, bind: UINode["bind"], description: string = "Update binding"): void {
    const node = this.findNodeById(nodeId);
    if (!node || !this.data.document) return;

    // Set to undefined if the binding object is empty
    const isEmpty = !bind || (
      !bind.path &&
      !bind.format &&
      !bind.formatString &&
      !bind.validation?.length &&
      bind.defaultValue === undefined &&
      !bind.direction &&
      !bind.transform
    );
    node.bind = isEmpty ? undefined : bind;
    this.markDirty();
    this.historyManager.commitChange(this.data.document, description);
    this.emit("node-updated", nodeId, { bind: node.bind });
  }

  // Screen contract management
  updateScreenContract(screenId: string, contract: Partial<ScreenContract>, description: string = "Update screen contract"): void {
    if (!this.data.document) return;

    const screen = this.data.document.screens[screenId];
    if (!screen) return;

    // Initialize with defaults if no contract exists
    const currentContract = screen.contract || createDefaultScreenContract();
    screen.contract = {
      ...currentContract,
      ...contract,
      // Handle nested objects properly
      referenceSize: contract.referenceSize
        ? { ...currentContract.referenceSize, ...contract.referenceSize }
        : currentContract.referenceSize,
      targetAspectRange: contract.targetAspectRange
        ? { ...currentContract.targetAspectRange, ...contract.targetAspectRange }
        : currentContract.targetAspectRange,
    };

    this.markDirty();
    this.historyManager.commitChange(this.data.document, description);
    this.emit("screen-contract-changed", screenId, screen.contract);
  }

  getScreenContract(screenId?: string): ScreenContract {
    const targetScreenId = screenId || this.data.currentScreenId;
    if (!this.data.document || !targetScreenId) {
      return createDefaultScreenContract();
    }

    const screen = this.data.document.screens[targetScreenId];
    return screen?.contract || createDefaultScreenContract();
  }

  // Token management
  updateToken(key: string, value: string | number, description: string = "Update token"): void {
    if (!this.data.document) return;

    this.data.document.tokens[key] = value;
    this.markDirty();
    this.historyManager.commitChange(this.data.document, description);
    this.emit("tokens-changed", key, value);
    // Also trigger node-updated to refresh canvas with new token values
    this.emit("node-updated", null, {});
  }

  deleteToken(key: string, description: string = "Delete token"): void {
    if (!this.data.document) return;

    delete this.data.document.tokens[key];
    this.markDirty();
    this.historyManager.commitChange(this.data.document, description);
    this.emit("tokens-changed", key, undefined);
    // Also trigger node-updated to refresh canvas
    this.emit("node-updated", null, {});
  }

  addNode(node: UINode, parentId?: string, description: string = "Add node"): void {
    const parent = parentId
      ? this.findNodeById(parentId)
      : this.getCurrentScreen()?.root;

    if (!parent || !this.data.document) return;

    if (!parent.children) {
      parent.children = [];
    }
    parent.children.push(node);
    this.markDirty();
    this.historyManager.commitChange(this.data.document, description);
    this.emit("node-added", node, parentId);
  }

  removeNode(nodeId: string, description: string = "Delete node"): void {
    const parent = this.findParentNode(nodeId);
    if (!parent || !parent.children || !this.data.document) return;

    const index = parent.children.findIndex((c) => c.id === nodeId);
    if (index !== -1) {
      parent.children.splice(index, 1);
      this.data.selectedNodeIds.delete(nodeId);
      this.markDirty();
      this.historyManager.commitChange(this.data.document, description);
      this.emit("node-removed", nodeId);
      this.emit("selection-changed", Array.from(this.data.selectedNodeIds));
    }
  }

  /**
   * Get the absolute position and size of a node (accounting for all parent offsets)
   * Supports both absolute and anchored layout modes
   */
  getAbsolutePosition(nodeId: string): { x: number; y: number; w: number; h: number } | null {
    const screen = this.getCurrentScreen();
    if (!screen) return null;

    // Get root dimensions for anchored layout calculations
    let rootWidth = 375;
    let rootHeight = 667;
    if (screen.root.layout.mode === "absolute") {
      rootWidth = screen.root.layout.w;
      rootHeight = screen.root.layout.h;
    }

    return this.getAbsolutePositionRecursive(nodeId, screen.root, 0, 0, rootWidth, rootHeight);
  }

  private getAbsolutePositionRecursive(
    nodeId: string,
    node: UINode,
    parentX: number,
    parentY: number,
    parentWidth: number,
    parentHeight: number
  ): { x: number; y: number; w: number; h: number } | null {
    // Calculate node bounds based on layout mode
    let x: number, y: number, w: number, h: number;

    if (node.layout.mode === "absolute") {
      x = node.layout.x;
      y = node.layout.y;
      w = node.layout.w;
      h = node.layout.h;
    } else if (node.layout.mode === "anchored") {
      const rect = anchoredToAbsolute(
        node.layout as AnchoredLayout,
        parentWidth,
        parentHeight
      );
      x = rect.x;
      y = rect.y;
      w = rect.w;
      h = rect.h;
    } else {
      return null;
    }

    const absoluteX = parentX + x;
    const absoluteY = parentY + y;

    if (node.id === nodeId) {
      return { x: absoluteX, y: absoluteY, w, h };
    }

    if (node.children) {
      for (const child of node.children) {
        const result = this.getAbsolutePositionRecursive(
          nodeId,
          child,
          absoluteX,
          absoluteY,
          w,
          h
        );
        if (result) return result;
      }
    }

    return null;
  }

  /**
   * Move a node to a new parent, adjusting coordinates to maintain visual position
   */
  reparentNode(nodeId: string, newParentId: string, description: string = "Reparent node"): boolean {
    // Don't reparent root
    if (nodeId === "root" || !this.data.document) return false;

    const node = this.findNodeById(nodeId);
    const newParent = this.findNodeById(newParentId);
    const currentParent = this.findParentNode(nodeId);

    if (!node || !newParent || !currentParent) return false;

    // Don't reparent to self or to a descendant
    if (newParentId === nodeId || this.isDescendant(newParentId, nodeId)) {
      return false;
    }

    // Don't reparent if already a child of target
    if (currentParent.id === newParentId) return false;

    // Get current absolute position before reparenting
    const absolutePos = this.getAbsolutePosition(nodeId);
    if (!absolutePos) return false;

    // Get new parent's absolute position
    const newParentAbsolutePos = this.getAbsolutePosition(newParentId);
    if (!newParentAbsolutePos) return false;

    // Remove from current parent
    if (currentParent.children) {
      const index = currentParent.children.findIndex((c) => c.id === nodeId);
      if (index !== -1) {
        currentParent.children.splice(index, 1);
      }
    }

    // Add to new parent
    if (!newParent.children) {
      newParent.children = [];
    }
    newParent.children.push(node);

    // Update node coordinates to be relative to new parent
    if (node.layout.mode === "absolute") {
      node.layout.x = absolutePos.x - newParentAbsolutePos.x;
      node.layout.y = absolutePos.y - newParentAbsolutePos.y;
    }

    this.markDirty();
    this.historyManager.commitChange(this.data.document, description);
    this.emit("node-updated", nodeId, { layout: node.layout });
    return true;
  }

  /**
   * Check if potentialDescendant is a descendant of ancestorId
   */
  private isDescendant(potentialDescendantId: string, ancestorId: string): boolean {
    const ancestor = this.findNodeById(ancestorId);
    if (!ancestor || !ancestor.children) return false;

    for (const child of ancestor.children) {
      if (child.id === potentialDescendantId) return true;
      if (this.isDescendant(potentialDescendantId, child.id)) return true;
    }
    return false;
  }

  /**
   * Find container node at given absolute coordinates, excluding specified node IDs
   * Returns the deepest (most nested) container at that position
   */
  findContainerAtPosition(
    worldX: number,
    worldY: number,
    excludeIds: string[]
  ): string | null {
    const screen = this.getCurrentScreen();
    if (!screen) return null;

    // Get root dimensions for anchored layout calculations
    let rootWidth = 375;
    let rootHeight = 667;
    if (screen.root.layout.mode === "absolute") {
      rootWidth = screen.root.layout.w;
      rootHeight = screen.root.layout.h;
    }

    return this.findContainerAtPositionRecursive(
      worldX,
      worldY,
      screen.root,
      0,
      0,
      rootWidth,
      rootHeight,
      excludeIds
    );
  }

  private findContainerAtPositionRecursive(
    worldX: number,
    worldY: number,
    node: UINode,
    parentX: number,
    parentY: number,
    parentWidth: number,
    parentHeight: number,
    excludeIds: string[]
  ): string | null {
    // Calculate node bounds based on layout mode
    let x: number, y: number, w: number, h: number;

    if (node.layout.mode === "absolute") {
      x = node.layout.x;
      y = node.layout.y;
      w = node.layout.w;
      h = node.layout.h;
    } else if (node.layout.mode === "anchored") {
      const rect = anchoredToAbsolute(
        node.layout as AnchoredLayout,
        parentWidth,
        parentHeight
      );
      x = rect.x;
      y = rect.y;
      w = rect.w;
      h = rect.h;
    } else {
      return null;
    }

    const nodeX = parentX + x;
    const nodeY = parentY + y;

    // Skip excluded nodes
    if (excludeIds.includes(node.id)) {
      return null;
    }

    // Check children first (deeper = more specific)
    if (node.children) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        const child = node.children[i];
        // Only check containers
        if (child.type === "Container" && !excludeIds.includes(child.id)) {
          const result = this.findContainerAtPositionRecursive(
            worldX,
            worldY,
            child,
            nodeX,
            nodeY,
            w,
            h,
            excludeIds
          );
          if (result) return result;
        }
      }
    }

    // Check if point is inside this node (and it's a container)
    if (
      node.type === "Container" &&
      worldX >= nodeX &&
      worldX <= nodeX + w &&
      worldY >= nodeY &&
      worldY <= nodeY + h
    ) {
      return node.id;
    }

    return null;
  }

  // Dirty state
  markDirty(): void {
    this.data.isDirty = true;
    this.emit("dirty-changed", true);
  }

  markClean(): void {
    this.data.isDirty = false;
    this.emit("dirty-changed", false);
  }

  isDirty(): boolean {
    return this.data.isDirty;
  }

  // Serialize for saving
  serialize(): string {
    if (!this.data.document) return "{}";
    return JSON.stringify(this.data.document, null, 2);
  }

  // History management
  getHistoryManager(): HistoryManager {
    return this.historyManager;
  }

  undo(): boolean {
    if (!this.data.document) return false;

    const restoredDoc = this.historyManager.undo(this.data.document);
    if (restoredDoc) {
      // Restore the document state
      this.data.document = restoredDoc;

      // Clear selection as nodes may no longer exist
      this.data.selectedNodeIds.clear();
      this.data.hoveredNodeId = null;

      // Update current screen if needed
      const screenIds = Object.keys(restoredDoc.screens);
      if (this.data.currentScreenId && !restoredDoc.screens[this.data.currentScreenId]) {
        this.data.currentScreenId = screenIds.length > 0 ? screenIds[0] : null;
      }

      this.markDirty();
      this.emit("document-loaded", restoredDoc);
      this.emit("selection-changed", []);
      this.emit("history-changed");
      return true;
    }
    return false;
  }

  redo(): boolean {
    if (!this.data.document) return false;

    const restoredDoc = this.historyManager.redo(this.data.document);
    if (restoredDoc) {
      // Restore the document state
      this.data.document = restoredDoc;

      // Clear selection as nodes may no longer exist
      this.data.selectedNodeIds.clear();
      this.data.hoveredNodeId = null;

      // Update current screen if needed
      const screenIds = Object.keys(restoredDoc.screens);
      if (this.data.currentScreenId && !restoredDoc.screens[this.data.currentScreenId]) {
        this.data.currentScreenId = screenIds.length > 0 ? screenIds[0] : null;
      }

      this.markDirty();
      this.emit("document-loaded", restoredDoc);
      this.emit("selection-changed", []);
      this.emit("history-changed");
      return true;
    }
    return false;
  }

  canUndo(): boolean {
    return this.historyManager.canUndo();
  }

  canRedo(): boolean {
    return this.historyManager.canRedo();
  }

  // Cleanup
  destroy(): void {
    this.listeners.clear();
    this.historyManager.clear();
    this.data.document = null;
    this.data.file = null;
  }
}

/**
 * Manages EditorState instances per file path.
 * Each UIDesign file gets its own isolated state.
 */
export class EditorStateManager {
  private states: Map<string, EditorState> = new Map();
  private activeFilePath: string | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();

  /**
   * Get or create an EditorState for a specific file path
   */
  getStateForFile(filePath: string): EditorState {
    let state = this.states.get(filePath);
    if (!state) {
      state = new EditorState();
      this.states.set(filePath, state);
    }
    return state;
  }

  /**
   * Get the state for the currently active file
   */
  getActiveState(): EditorState | null {
    if (!this.activeFilePath) return null;
    return this.states.get(this.activeFilePath) || null;
  }

  /**
   * Set the active file path and notify listeners
   */
  setActiveFile(filePath: string | null): void {
    if (this.activeFilePath === filePath) return;

    this.activeFilePath = filePath;
    this.emit("active-state-changed", filePath ? this.getStateForFile(filePath) : null);
  }

  /**
   * Get the active file path
   */
  getActiveFilePath(): string | null {
    return this.activeFilePath;
  }

  /**
   * Remove state for a file (call when file is closed)
   */
  removeStateForFile(filePath: string): void {
    const state = this.states.get(filePath);
    if (state) {
      state.destroy();
      this.states.delete(filePath);
    }

    if (this.activeFilePath === filePath) {
      this.activeFilePath = null;
    }
  }

  /**
   * Subscribe to manager events
   */
  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Unsubscribe from manager events
   */
  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((cb) => cb(...args));
  }

  /**
   * Clean up all states
   */
  destroy(): void {
    for (const state of this.states.values()) {
      state.destroy();
    }
    this.states.clear();
    this.listeners.clear();
    this.activeFilePath = null;
  }
}

// Singleton manager instance
let stateManager: EditorStateManager | null = null;

export function getEditorStateManager(): EditorStateManager {
  if (!stateManager) {
    stateManager = new EditorStateManager();
  }
  return stateManager;
}

export function resetEditorStateManager(): void {
  if (stateManager) {
    stateManager.destroy();
    stateManager = null;
  }
}

// Legacy compatibility - get active state (for sidebar views during transition)
export function getEditorState(): EditorState | null {
  return getEditorStateManager().getActiveState();
}
