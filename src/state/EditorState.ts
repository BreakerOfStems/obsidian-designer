import { TFile } from "obsidian";
import {
  UIDocument,
  UINode,
  Screen,
  createEmptyDocument,
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
    this.historyManager = new HistoryManager(this);
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

  // Modification methods
  updateNode(nodeId: string, updates: Partial<UINode>): void {
    const node = this.findNodeById(nodeId);
    if (!node) return;

    Object.assign(node, updates);
    this.markDirty();
    this.emit("node-updated", nodeId, updates);
  }

  updateNodeLayout(
    nodeId: string,
    layout: Partial<UINode["layout"]>
  ): void {
    const node = this.findNodeById(nodeId);
    if (!node) return;

    node.layout = { ...node.layout, ...layout } as UINode["layout"];
    this.markDirty();
    this.emit("node-updated", nodeId, { layout: node.layout });
  }

  updateNodeStyle(nodeId: string, style: Partial<UINode["style"]>): void {
    const node = this.findNodeById(nodeId);
    if (!node) return;

    node.style = { ...node.style, ...style };
    this.markDirty();
    this.emit("node-updated", nodeId, { style: node.style });
  }

  addNode(node: UINode, parentId?: string): void {
    const parent = parentId
      ? this.findNodeById(parentId)
      : this.getCurrentScreen()?.root;

    if (!parent) return;

    if (!parent.children) {
      parent.children = [];
    }
    parent.children.push(node);
    this.markDirty();
    this.emit("node-added", node, parentId);
  }

  removeNode(nodeId: string): void {
    const parent = this.findParentNode(nodeId);
    if (!parent || !parent.children) return;

    const index = parent.children.findIndex((c) => c.id === nodeId);
    if (index !== -1) {
      parent.children.splice(index, 1);
      this.data.selectedNodeIds.delete(nodeId);
      this.markDirty();
      this.emit("node-removed", nodeId);
      this.emit("selection-changed", Array.from(this.data.selectedNodeIds));
    }
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
    const result = this.historyManager.undo();
    if (result) {
      this.emit("history-changed");
    }
    return result;
  }

  redo(): boolean {
    const result = this.historyManager.redo();
    if (result) {
      this.emit("history-changed");
    }
    return result;
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

// Singleton instance for sharing across views
let globalState: EditorState | null = null;

export function getEditorState(): EditorState {
  if (!globalState) {
    globalState = new EditorState();
  }
  return globalState;
}

export function resetEditorState(): void {
  if (globalState) {
    globalState.destroy();
    globalState = null;
  }
}
