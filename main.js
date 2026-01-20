var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => UIDesignerPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/views/UIEditorView.ts
var import_obsidian2 = require("obsidian");

// src/types/ui-schema.ts
function createEmptyDocument(name) {
  return {
    version: "1.0",
    name: name || "Untitled",
    tokens: {
      "color.primary": "#2E6BE6",
      "color.secondary": "#6B7280",
      "color.background": "#FFFFFF",
      "color.surface": "#F3F4F6",
      "color.text": "#1F2937",
      "color.textMuted": "#6B7280",
      "font.body": "Inter, sans-serif",
      "font.heading": "Inter, sans-serif",
      "space.xs": 4,
      "space.sm": 8,
      "space.md": 16,
      "space.lg": 24,
      "space.xl": 32,
      "radius.sm": 4,
      "radius.md": 8,
      "radius.lg": 12
    },
    components: {},
    screens: {}
  };
}
function createNode(type, overrides) {
  const id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const baseNode = {
    id,
    type,
    name: type,
    layout: {
      mode: "absolute",
      x: 100,
      y: 100,
      w: type === "Button" ? 120 : type === "Text" ? 200 : 200,
      h: type === "Button" ? 40 : type === "Text" ? 24 : 100
    },
    style: {
      background: type === "Button" ? "color.primary" : "color.surface",
      textColor: type === "Button" ? "#FFFFFF" : "color.text",
      borderRadius: 4
    },
    content: {
      text: type === "Button" ? "Button" : type === "Text" ? "Text" : void 0
    },
    meta: {}
  };
  return { ...baseNode, ...overrides };
}
function resolveToken(value, tokens) {
  if (value === void 0)
    return void 0;
  if (typeof value === "number")
    return value;
  if (value.startsWith("#") || value.startsWith("rgb"))
    return value;
  if (tokens[value] !== void 0) {
    return tokens[value];
  }
  return value;
}

// src/state/HistoryManager.ts
var HistoryManager = class {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistorySize = 50;
    this.currentDocumentJson = "";
    this.pendingDescription = "Change";
    this.batchDepth = 0;
    this.batchStartJson = "";
  }
  /**
   * Set the current document state (call this when document is loaded)
   */
  setCurrentState(doc) {
    this.currentDocumentJson = JSON.stringify(doc);
  }
  /**
   * Call before making a change to capture the "before" state.
   * Use description to identify what action is being performed.
   */
  beginChange(description = "Change") {
    this.pendingDescription = description;
  }
  /**
   * Start a batch of changes that should be undone as a single action.
   * Call endBatch() when done. Batches can be nested.
   */
  startBatch(description = "Change") {
    if (this.batchDepth === 0) {
      this.batchStartJson = this.currentDocumentJson;
      this.pendingDescription = description;
    }
    this.batchDepth++;
  }
  /**
   * End a batch of changes
   */
  endBatch(doc) {
    if (this.batchDepth > 0) {
      this.batchDepth--;
      if (this.batchDepth === 0) {
        const newJson = JSON.stringify(doc);
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
  commitChange(doc, description) {
    if (this.batchDepth > 0) {
      return;
    }
    const newJson = JSON.stringify(doc);
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
  undo(currentDoc) {
    const snapshot = this.undoStack.pop();
    if (!snapshot)
      return null;
    this.redoStack.push({
      timestamp: Date.now(),
      description: snapshot.description,
      documentJson: JSON.stringify(currentDoc)
    });
    const restoredDoc = JSON.parse(snapshot.documentJson);
    this.currentDocumentJson = snapshot.documentJson;
    return restoredDoc;
  }
  /**
   * Redo the last undone action.
   * Returns the document state to restore, or null if nothing to redo.
   */
  redo(currentDoc) {
    const snapshot = this.redoStack.pop();
    if (!snapshot)
      return null;
    this.undoStack.push({
      timestamp: Date.now(),
      description: snapshot.description,
      documentJson: JSON.stringify(currentDoc)
    });
    const restoredDoc = JSON.parse(snapshot.documentJson);
    this.currentDocumentJson = snapshot.documentJson;
    return restoredDoc;
  }
  /**
   * Check if undo is available
   */
  canUndo() {
    return this.undoStack.length > 0;
  }
  /**
   * Check if redo is available
   */
  canRedo() {
    return this.redoStack.length > 0;
  }
  /**
   * Get the description of the next undo action
   */
  getUndoDescription() {
    var _a;
    const entry = this.undoStack[this.undoStack.length - 1];
    return (_a = entry == null ? void 0 : entry.description) != null ? _a : null;
  }
  /**
   * Get the description of the next redo action
   */
  getRedoDescription() {
    var _a;
    const entry = this.redoStack[this.redoStack.length - 1];
    return (_a = entry == null ? void 0 : entry.description) != null ? _a : null;
  }
  /**
   * Clear all history
   */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.batchDepth = 0;
    this.batchStartJson = "";
  }
  /**
   * Get undo stack size (for debugging)
   */
  getUndoStackSize() {
    return this.undoStack.length;
  }
  /**
   * Get redo stack size (for debugging)
   */
  getRedoStackSize() {
    return this.redoStack.length;
  }
  pushSnapshot(documentJson, description) {
    this.undoStack.push({
      timestamp: Date.now(),
      description,
      documentJson
    });
    this.redoStack = [];
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }
  }
};

// src/state/EditorState.ts
var EditorState = class {
  constructor() {
    this.data = {
      document: null,
      file: null,
      currentScreenId: null,
      selectedNodeIds: /* @__PURE__ */ new Set(),
      hoveredNodeId: null,
      viewport: { panX: 0, panY: 0, zoom: 1 },
      isDirty: false
    };
    this.listeners = /* @__PURE__ */ new Map();
    this.historyManager = new HistoryManager();
  }
  // Event emitter methods
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, /* @__PURE__ */ new Set());
    }
    this.listeners.get(event).add(callback);
  }
  off(event, callback) {
    var _a;
    (_a = this.listeners.get(event)) == null ? void 0 : _a.delete(callback);
  }
  emit(event, ...args) {
    var _a;
    (_a = this.listeners.get(event)) == null ? void 0 : _a.forEach((cb) => cb(...args));
  }
  // Document management
  loadDocument(doc, file) {
    this.data.document = doc;
    this.data.file = file;
    this.data.isDirty = false;
    this.data.selectedNodeIds.clear();
    this.data.hoveredNodeId = null;
    const screenIds = Object.keys(doc.screens);
    this.data.currentScreenId = screenIds.length > 0 ? screenIds[0] : null;
    this.historyManager.clear();
    this.historyManager.setCurrentState(doc);
    this.emit("document-loaded", doc);
    this.emit("selection-changed", []);
  }
  getDocument() {
    return this.data.document;
  }
  getFile() {
    return this.data.file;
  }
  createNewDocument(name) {
    const doc = createEmptyDocument(name);
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
          h: 667
        },
        style: {
          background: "color.background"
        },
        children: []
      }
    };
    return doc;
  }
  // Screen management
  getCurrentScreen() {
    if (!this.data.document || !this.data.currentScreenId)
      return null;
    return this.data.document.screens[this.data.currentScreenId] || null;
  }
  setCurrentScreen(screenId) {
    var _a;
    if ((_a = this.data.document) == null ? void 0 : _a.screens[screenId]) {
      this.data.currentScreenId = screenId;
      this.data.selectedNodeIds.clear();
      this.emit("screen-changed", screenId);
      this.emit("selection-changed", []);
    }
  }
  // Node selection
  selectNode(nodeId, addToSelection = false) {
    if (!addToSelection) {
      this.data.selectedNodeIds.clear();
    }
    this.data.selectedNodeIds.add(nodeId);
    this.emit("selection-changed", Array.from(this.data.selectedNodeIds));
  }
  deselectNode(nodeId) {
    this.data.selectedNodeIds.delete(nodeId);
    this.emit("selection-changed", Array.from(this.data.selectedNodeIds));
  }
  clearSelection() {
    this.data.selectedNodeIds.clear();
    this.emit("selection-changed", []);
  }
  getSelectedNodeIds() {
    return Array.from(this.data.selectedNodeIds);
  }
  isNodeSelected(nodeId) {
    return this.data.selectedNodeIds.has(nodeId);
  }
  getSelectedNode() {
    const ids = this.getSelectedNodeIds();
    if (ids.length !== 1)
      return null;
    return this.findNodeById(ids[0]);
  }
  // Node hover
  setHoveredNode(nodeId) {
    if (this.data.hoveredNodeId !== nodeId) {
      this.data.hoveredNodeId = nodeId;
      this.emit("hover-changed", nodeId);
    }
  }
  getHoveredNodeId() {
    return this.data.hoveredNodeId;
  }
  // Viewport
  setViewport(viewport) {
    this.data.viewport = { ...this.data.viewport, ...viewport };
    this.emit("viewport-changed", this.data.viewport);
  }
  getViewport() {
    return { ...this.data.viewport };
  }
  // Find node by ID (recursive search)
  findNodeById(nodeId, root) {
    var _a;
    const searchRoot = root || ((_a = this.getCurrentScreen()) == null ? void 0 : _a.root);
    if (!searchRoot)
      return null;
    if (searchRoot.id === nodeId)
      return searchRoot;
    if (searchRoot.children) {
      for (const child of searchRoot.children) {
        const found = this.findNodeById(nodeId, child);
        if (found)
          return found;
      }
    }
    return null;
  }
  // Find parent of a node
  findParentNode(nodeId, root) {
    var _a;
    const searchRoot = root || ((_a = this.getCurrentScreen()) == null ? void 0 : _a.root);
    if (!searchRoot || !searchRoot.children)
      return null;
    for (const child of searchRoot.children) {
      if (child.id === nodeId)
        return searchRoot;
      const found = this.findParentNode(nodeId, child);
      if (found)
        return found;
    }
    return null;
  }
  // Collect all nodes flat
  getAllNodes(root) {
    var _a;
    const searchRoot = root || ((_a = this.getCurrentScreen()) == null ? void 0 : _a.root);
    if (!searchRoot)
      return [];
    const nodes = [searchRoot];
    if (searchRoot.children) {
      for (const child of searchRoot.children) {
        nodes.push(...this.getAllNodes(child));
      }
    }
    return nodes;
  }
  // Batch operations for grouping multiple changes into one undo step
  startBatch(description) {
    this.historyManager.startBatch(description);
  }
  endBatch() {
    if (this.data.document) {
      this.historyManager.endBatch(this.data.document);
    }
  }
  // Modification methods
  updateNode(nodeId, updates, description = "Update node") {
    const node = this.findNodeById(nodeId);
    if (!node || !this.data.document)
      return;
    Object.assign(node, updates);
    this.markDirty();
    this.historyManager.commitChange(this.data.document, description);
    this.emit("node-updated", nodeId, updates);
  }
  updateNodeLayout(nodeId, layout, description = "Move/resize") {
    const node = this.findNodeById(nodeId);
    if (!node || !this.data.document)
      return;
    node.layout = { ...node.layout, ...layout };
    this.markDirty();
    this.historyManager.commitChange(this.data.document, description);
    this.emit("node-updated", nodeId, { layout: node.layout });
  }
  updateNodeStyle(nodeId, style, description = "Update style") {
    const node = this.findNodeById(nodeId);
    if (!node || !this.data.document)
      return;
    node.style = { ...node.style, ...style };
    this.markDirty();
    this.historyManager.commitChange(this.data.document, description);
    this.emit("node-updated", nodeId, { style: node.style });
  }
  addNode(node, parentId, description = "Add node") {
    var _a;
    const parent = parentId ? this.findNodeById(parentId) : (_a = this.getCurrentScreen()) == null ? void 0 : _a.root;
    if (!parent || !this.data.document)
      return;
    if (!parent.children) {
      parent.children = [];
    }
    parent.children.push(node);
    this.markDirty();
    this.historyManager.commitChange(this.data.document, description);
    this.emit("node-added", node, parentId);
  }
  removeNode(nodeId, description = "Delete node") {
    const parent = this.findParentNode(nodeId);
    if (!parent || !parent.children || !this.data.document)
      return;
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
   * Get the absolute position of a node (accounting for all parent offsets)
   */
  getAbsolutePosition(nodeId) {
    const screen = this.getCurrentScreen();
    if (!screen)
      return null;
    return this.getAbsolutePositionRecursive(nodeId, screen.root, 0, 0);
  }
  getAbsolutePositionRecursive(nodeId, node, parentX, parentY) {
    if (node.layout.mode !== "absolute")
      return null;
    const absoluteX = parentX + node.layout.x;
    const absoluteY = parentY + node.layout.y;
    if (node.id === nodeId) {
      return { x: absoluteX, y: absoluteY };
    }
    if (node.children) {
      for (const child of node.children) {
        const result = this.getAbsolutePositionRecursive(
          nodeId,
          child,
          absoluteX,
          absoluteY
        );
        if (result)
          return result;
      }
    }
    return null;
  }
  /**
   * Move a node to a new parent, adjusting coordinates to maintain visual position
   */
  reparentNode(nodeId, newParentId, description = "Reparent node") {
    if (nodeId === "root" || !this.data.document)
      return false;
    const node = this.findNodeById(nodeId);
    const newParent = this.findNodeById(newParentId);
    const currentParent = this.findParentNode(nodeId);
    if (!node || !newParent || !currentParent)
      return false;
    if (newParentId === nodeId || this.isDescendant(newParentId, nodeId)) {
      return false;
    }
    if (currentParent.id === newParentId)
      return false;
    const absolutePos = this.getAbsolutePosition(nodeId);
    if (!absolutePos)
      return false;
    const newParentAbsolutePos = this.getAbsolutePosition(newParentId);
    if (!newParentAbsolutePos)
      return false;
    if (currentParent.children) {
      const index = currentParent.children.findIndex((c) => c.id === nodeId);
      if (index !== -1) {
        currentParent.children.splice(index, 1);
      }
    }
    if (!newParent.children) {
      newParent.children = [];
    }
    newParent.children.push(node);
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
  isDescendant(potentialDescendantId, ancestorId) {
    const ancestor = this.findNodeById(ancestorId);
    if (!ancestor || !ancestor.children)
      return false;
    for (const child of ancestor.children) {
      if (child.id === potentialDescendantId)
        return true;
      if (this.isDescendant(potentialDescendantId, child.id))
        return true;
    }
    return false;
  }
  /**
   * Find container node at given absolute coordinates, excluding specified node IDs
   * Returns the deepest (most nested) container at that position
   */
  findContainerAtPosition(worldX, worldY, excludeIds) {
    const screen = this.getCurrentScreen();
    if (!screen)
      return null;
    return this.findContainerAtPositionRecursive(
      worldX,
      worldY,
      screen.root,
      0,
      0,
      excludeIds
    );
  }
  findContainerAtPositionRecursive(worldX, worldY, node, parentX, parentY, excludeIds) {
    if (node.layout.mode !== "absolute")
      return null;
    const nodeX = parentX + node.layout.x;
    const nodeY = parentY + node.layout.y;
    if (excludeIds.includes(node.id)) {
      return null;
    }
    if (node.children) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        const child = node.children[i];
        if (child.type === "Container" && !excludeIds.includes(child.id)) {
          const result = this.findContainerAtPositionRecursive(
            worldX,
            worldY,
            child,
            nodeX,
            nodeY,
            excludeIds
          );
          if (result)
            return result;
        }
      }
    }
    if (node.type === "Container" && worldX >= nodeX && worldX <= nodeX + node.layout.w && worldY >= nodeY && worldY <= nodeY + node.layout.h) {
      return node.id;
    }
    return null;
  }
  // Dirty state
  markDirty() {
    this.data.isDirty = true;
    this.emit("dirty-changed", true);
  }
  markClean() {
    this.data.isDirty = false;
    this.emit("dirty-changed", false);
  }
  isDirty() {
    return this.data.isDirty;
  }
  // Serialize for saving
  serialize() {
    if (!this.data.document)
      return "{}";
    return JSON.stringify(this.data.document, null, 2);
  }
  // History management
  getHistoryManager() {
    return this.historyManager;
  }
  undo() {
    if (!this.data.document)
      return false;
    const restoredDoc = this.historyManager.undo(this.data.document);
    if (restoredDoc) {
      this.data.document = restoredDoc;
      this.data.selectedNodeIds.clear();
      this.data.hoveredNodeId = null;
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
  redo() {
    if (!this.data.document)
      return false;
    const restoredDoc = this.historyManager.redo(this.data.document);
    if (restoredDoc) {
      this.data.document = restoredDoc;
      this.data.selectedNodeIds.clear();
      this.data.hoveredNodeId = null;
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
  canUndo() {
    return this.historyManager.canUndo();
  }
  canRedo() {
    return this.historyManager.canRedo();
  }
  // Cleanup
  destroy() {
    this.listeners.clear();
    this.historyManager.clear();
    this.data.document = null;
    this.data.file = null;
  }
};
var EditorStateManager = class {
  constructor() {
    this.states = /* @__PURE__ */ new Map();
    this.activeFilePath = null;
    this.listeners = /* @__PURE__ */ new Map();
  }
  /**
   * Get or create an EditorState for a specific file path
   */
  getStateForFile(filePath) {
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
  getActiveState() {
    if (!this.activeFilePath)
      return null;
    return this.states.get(this.activeFilePath) || null;
  }
  /**
   * Set the active file path and notify listeners
   */
  setActiveFile(filePath) {
    if (this.activeFilePath === filePath)
      return;
    this.activeFilePath = filePath;
    this.emit("active-state-changed", filePath ? this.getStateForFile(filePath) : null);
  }
  /**
   * Get the active file path
   */
  getActiveFilePath() {
    return this.activeFilePath;
  }
  /**
   * Remove state for a file (call when file is closed)
   */
  removeStateForFile(filePath) {
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
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, /* @__PURE__ */ new Set());
    }
    this.listeners.get(event).add(callback);
  }
  /**
   * Unsubscribe from manager events
   */
  off(event, callback) {
    var _a;
    (_a = this.listeners.get(event)) == null ? void 0 : _a.delete(callback);
  }
  emit(event, ...args) {
    var _a;
    (_a = this.listeners.get(event)) == null ? void 0 : _a.forEach((cb) => cb(...args));
  }
  /**
   * Clean up all states
   */
  destroy() {
    for (const state of this.states.values()) {
      state.destroy();
    }
    this.states.clear();
    this.listeners.clear();
    this.activeFilePath = null;
  }
};
var stateManager = null;
function getEditorStateManager() {
  if (!stateManager) {
    stateManager = new EditorStateManager();
  }
  return stateManager;
}
function resetEditorStateManager() {
  if (stateManager) {
    stateManager.destroy();
    stateManager = null;
  }
}

// src/canvas/CanvasRenderer.ts
var CanvasRenderer = class {
  constructor(canvas, state) {
    this.animationFrameId = null;
    this.dpr = 1;
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw new Error("Could not get 2D context");
    this.ctx = ctx;
    this.state = state;
    this.dpr = window.devicePixelRatio || 1;
    this.setupCanvas();
    this.state.on("node-updated", () => this.requestRender());
    this.state.on("node-added", () => this.requestRender());
    this.state.on("node-removed", () => this.requestRender());
    this.state.on("selection-changed", () => this.requestRender());
    this.state.on("hover-changed", () => this.requestRender());
    this.state.on("viewport-changed", () => this.requestRender());
    this.state.on("document-loaded", () => this.requestRender());
    this.state.on("screen-changed", () => this.requestRender());
  }
  setupCanvas() {
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }
  resize() {
    var _a;
    const rect = (_a = this.canvas.parentElement) == null ? void 0 : _a.getBoundingClientRect();
    if (!rect)
      return;
    const width = rect.width;
    const height = rect.height;
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.scale(this.dpr, this.dpr);
    this.requestRender();
  }
  requestRender() {
    if (this.animationFrameId !== null)
      return;
    this.animationFrameId = requestAnimationFrame(() => {
      this.render();
      this.animationFrameId = null;
    });
  }
  render() {
    const doc = this.state.getDocument();
    const screen = this.state.getCurrentScreen();
    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = "#1a1a2e";
    this.ctx.fillRect(0, 0, width, height);
    if (!doc || !screen) {
      this.drawEmptyState(width, height);
      return;
    }
    const viewport = this.state.getViewport();
    this.ctx.save();
    this.ctx.translate(viewport.panX, viewport.panY);
    this.ctx.scale(viewport.zoom, viewport.zoom);
    this.drawGrid(width, height, viewport);
    const renderCtx = {
      ctx: this.ctx,
      tokens: doc.tokens,
      viewport,
      selectedIds: new Set(this.state.getSelectedNodeIds()),
      hoveredId: this.state.getHoveredNodeId(),
      devicePixelRatio: this.dpr
    };
    this.renderNode(screen.root, renderCtx);
    this.ctx.restore();
  }
  drawEmptyState(width, height) {
    this.ctx.fillStyle = "#666";
    this.ctx.font = "16px Inter, sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.fillText("No document loaded", width / 2, height / 2);
  }
  drawGrid(width, height, viewport) {
    const gridSize = 20;
    const majorGridSize = 100;
    const startX = -viewport.panX / viewport.zoom;
    const startY = -viewport.panY / viewport.zoom;
    const endX = startX + width / viewport.zoom;
    const endY = startY + height / viewport.zoom;
    this.ctx.strokeStyle = "#2a2a4a";
    this.ctx.lineWidth = 0.5 / viewport.zoom;
    this.ctx.beginPath();
    const minorStartX = Math.floor(startX / gridSize) * gridSize;
    const minorStartY = Math.floor(startY / gridSize) * gridSize;
    for (let x = minorStartX; x <= endX; x += gridSize) {
      this.ctx.moveTo(x, startY);
      this.ctx.lineTo(x, endY);
    }
    for (let y = minorStartY; y <= endY; y += gridSize) {
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(endX, y);
    }
    this.ctx.stroke();
    this.ctx.strokeStyle = "#3a3a5a";
    this.ctx.lineWidth = 1 / viewport.zoom;
    this.ctx.beginPath();
    const majorStartX = Math.floor(startX / majorGridSize) * majorGridSize;
    const majorStartY = Math.floor(startY / majorGridSize) * majorGridSize;
    for (let x = majorStartX; x <= endX; x += majorGridSize) {
      this.ctx.moveTo(x, startY);
      this.ctx.lineTo(x, endY);
    }
    for (let y = majorStartY; y <= endY; y += majorGridSize) {
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(endX, y);
    }
    this.ctx.stroke();
    this.ctx.strokeStyle = "#666";
    this.ctx.lineWidth = 2 / viewport.zoom;
    this.ctx.beginPath();
    this.ctx.moveTo(-10, 0);
    this.ctx.lineTo(10, 0);
    this.ctx.moveTo(0, -10);
    this.ctx.lineTo(0, 10);
    this.ctx.stroke();
  }
  renderNode(node, ctx) {
    var _a, _b, _c, _d, _e;
    if (node.layout.mode !== "absolute")
      return;
    const { x, y, w, h } = node.layout;
    const isSelected = ctx.selectedIds.has(node.id);
    const isHovered = ctx.hoveredId === node.id;
    const bgColor = this.resolveColor((_a = node.style) == null ? void 0 : _a.background, ctx.tokens);
    const textColor = this.resolveColor((_b = node.style) == null ? void 0 : _b.textColor, ctx.tokens);
    const borderRadius = ((_c = node.style) == null ? void 0 : _c.borderRadius) || 0;
    if (bgColor) {
      ctx.ctx.fillStyle = bgColor;
      this.roundRect(ctx.ctx, x, y, w, h, borderRadius);
      ctx.ctx.fill();
    }
    if (node.type === "Container" || isSelected || isHovered) {
      ctx.ctx.strokeStyle = isSelected ? "#2E6BE6" : isHovered ? "#5a8dee" : "#555";
      ctx.ctx.lineWidth = isSelected ? 2 / ctx.viewport.zoom : 1 / ctx.viewport.zoom;
      this.roundRect(ctx.ctx, x, y, w, h, borderRadius);
      ctx.ctx.stroke();
    }
    if ((_d = node.content) == null ? void 0 : _d.text) {
      ctx.ctx.fillStyle = textColor || "#333";
      ctx.ctx.font = `14px Inter, sans-serif`;
      ctx.ctx.textAlign = "center";
      ctx.ctx.textBaseline = "middle";
      ctx.ctx.fillText(node.content.text, x + w / 2, y + h / 2);
    }
    if (node.type === "Container" && !((_e = node.content) == null ? void 0 : _e.text)) {
      ctx.ctx.fillStyle = "#888";
      ctx.ctx.font = `10px Inter, sans-serif`;
      ctx.ctx.textAlign = "left";
      ctx.ctx.textBaseline = "top";
      ctx.ctx.fillText(node.name || node.type, x + 4, y + 4);
    }
    if (isSelected) {
      this.drawSelectionHandles(ctx.ctx, x, y, w, h, ctx.viewport.zoom);
    }
    if (node.children) {
      for (const child of node.children) {
        ctx.ctx.save();
        ctx.ctx.translate(x, y);
        const childLayout = { ...child.layout };
        this.renderNode(child, ctx);
        ctx.ctx.restore();
      }
    }
  }
  resolveColor(value, tokens) {
    if (!value)
      return null;
    const resolved = resolveToken(value, tokens);
    return typeof resolved === "string" ? resolved : null;
  }
  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  drawSelectionHandles(ctx, x, y, w, h, zoom) {
    const handleSize = 8 / zoom;
    const handles = [
      { x: x - handleSize / 2, y: y - handleSize / 2 },
      // top-left
      { x: x + w / 2 - handleSize / 2, y: y - handleSize / 2 },
      // top-center
      { x: x + w - handleSize / 2, y: y - handleSize / 2 },
      // top-right
      { x: x + w - handleSize / 2, y: y + h / 2 - handleSize / 2 },
      // right-center
      { x: x + w - handleSize / 2, y: y + h - handleSize / 2 },
      // bottom-right
      { x: x + w / 2 - handleSize / 2, y: y + h - handleSize / 2 },
      // bottom-center
      { x: x - handleSize / 2, y: y + h - handleSize / 2 },
      // bottom-left
      { x: x - handleSize / 2, y: y + h / 2 - handleSize / 2 }
      // left-center
    ];
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#2E6BE6";
    ctx.lineWidth = 1 / zoom;
    for (const handle of handles) {
      ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
      ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
    }
  }
  // Hit testing - returns node ID at given screen coordinates
  hitTest(screenX, screenY) {
    const screen = this.state.getCurrentScreen();
    if (!screen)
      return null;
    const viewport = this.state.getViewport();
    const worldX = (screenX - viewport.panX) / viewport.zoom;
    const worldY = (screenY - viewport.panY) / viewport.zoom;
    return this.hitTestNode(screen.root, worldX, worldY, 0, 0);
  }
  hitTestNode(node, worldX, worldY, parentX, parentY) {
    if (node.layout.mode !== "absolute")
      return null;
    const { x, y, w, h } = node.layout;
    const nodeX = parentX + x;
    const nodeY = parentY + y;
    if (node.children) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        const hit = this.hitTestNode(
          node.children[i],
          worldX,
          worldY,
          nodeX,
          nodeY
        );
        if (hit)
          return hit;
      }
    }
    if (worldX >= nodeX && worldX <= nodeX + w && worldY >= nodeY && worldY <= nodeY + h) {
      return node.id;
    }
    return null;
  }
  // Get handle at position (for resize)
  getHandleAtPosition(screenX, screenY) {
    const selectedNode = this.state.getSelectedNode();
    if (!selectedNode || selectedNode.layout.mode !== "absolute")
      return null;
    const viewport = this.state.getViewport();
    const worldX = (screenX - viewport.panX) / viewport.zoom;
    const worldY = (screenY - viewport.panY) / viewport.zoom;
    const absolutePos = this.state.getAbsolutePosition(selectedNode.id);
    if (!absolutePos)
      return null;
    const x = absolutePos.x;
    const y = absolutePos.y;
    const { w, h } = selectedNode.layout;
    const handleSize = 8 / viewport.zoom;
    const tolerance = handleSize;
    const handles = {
      "nw": { x, y },
      "n": { x: x + w / 2, y },
      "ne": { x: x + w, y },
      "e": { x: x + w, y: y + h / 2 },
      "se": { x: x + w, y: y + h },
      "s": { x: x + w / 2, y: y + h },
      "sw": { x, y: y + h },
      "w": { x, y: y + h / 2 }
    };
    for (const [name, pos] of Object.entries(handles)) {
      if (Math.abs(worldX - pos.x) <= tolerance && Math.abs(worldY - pos.y) <= tolerance) {
        return name;
      }
    }
    return null;
  }
  destroy() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener("resize", () => this.resize());
  }
};

// src/canvas/CanvasInteraction.ts
var import_obsidian = require("obsidian");

// src/clipboard/ClipboardService.ts
var ClipboardService = class {
  constructor(state) {
    this.clipboard = null;
    this.gridStep = 10;
    this.maxOverlapAttempts = 10;
    this.state = state;
  }
  /**
   * Copy selected nodes to clipboard
   * Returns true if any nodes were copied
   */
  copy() {
    const selectedIds = this.state.getSelectedNodeIds();
    if (selectedIds.length === 0) {
      return false;
    }
    const nodesToCopy = [];
    const rootNodeIds = [];
    for (const id of selectedIds) {
      const node = this.state.findNodeById(id);
      if (node && node.id !== "root") {
        const clonedNode = this.deepCloneNode(node);
        nodesToCopy.push(clonedNode);
        rootNodeIds.push(clonedNode.id);
      }
    }
    if (nodesToCopy.length === 0) {
      return false;
    }
    const boundingBox = this.calculateBoundingBox(nodesToCopy);
    const doc = this.state.getDocument();
    const sourceDocumentId = (doc == null ? void 0 : doc.name) || "unknown";
    this.clipboard = {
      schemaVersion: 1,
      copiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      sourceDocumentId,
      nodes: nodesToCopy,
      rootNodeIds,
      boundingBox
    };
    this.copyToSystemClipboard(this.clipboard);
    return true;
  }
  /**
   * Paste nodes from clipboard at the specified cursor position
   * Returns array of pasted node IDs, or null if paste failed
   */
  paste(cursorX, cursorY) {
    if (!this.clipboard || this.clipboard.nodes.length === 0) {
      return null;
    }
    const screen = this.state.getCurrentScreen();
    if (!screen) {
      return null;
    }
    const anchor = {
      x: this.clipboard.boundingBox.minX,
      y: this.clipboard.boundingBox.minY
    };
    let deltaX = cursorX - anchor.x;
    let deltaY = cursorY - anchor.y;
    const idMapping = /* @__PURE__ */ new Map();
    const pastedNodes = [];
    for (const node of this.clipboard.nodes) {
      const newNode = this.cloneWithNewIds(node, idMapping);
      pastedNodes.push(newNode);
    }
    for (const node of pastedNodes) {
      this.translateNode(node, deltaX, deltaY);
    }
    let newBoundingBox = this.calculateBoundingBox(pastedNodes);
    const originalBoundingBox = this.clipboard.boundingBox;
    let attempts = 0;
    while (attempts < this.maxOverlapAttempts && this.boundingBoxesOverlap(newBoundingBox, originalBoundingBox)) {
      const nudgeX = this.snapToGrid(this.gridStep);
      const nudgeY = this.snapToGrid(this.gridStep);
      for (const node of pastedNodes) {
        this.translateNode(node, nudgeX, nudgeY);
      }
      newBoundingBox = this.calculateBoundingBox(pastedNodes);
      attempts++;
    }
    const parentId = this.determineParent(pastedNodes, cursorX, cursorY);
    const description = `Paste ${pastedNodes.length} component${pastedNodes.length > 1 ? "s" : ""}`;
    this.state.startBatch(description);
    const pastedIds = [];
    for (const node of pastedNodes) {
      this.state.addNode(node, parentId, description);
      pastedIds.push(node.id);
    }
    this.state.endBatch();
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
  duplicate() {
    if (!this.copy()) {
      return null;
    }
    const boundingBox = this.clipboard.boundingBox;
    const offsetX = boundingBox.minX + this.gridStep * 2;
    const offsetY = boundingBox.minY + this.gridStep * 2;
    return this.paste(offsetX, offsetY);
  }
  /**
   * Check if clipboard has content
   */
  hasContent() {
    return this.clipboard !== null && this.clipboard.nodes.length > 0;
  }
  /**
   * Get the current clipboard content (for debugging/inspection)
   */
  getClipboard() {
    return this.clipboard;
  }
  /**
   * Set grid step for overlap avoidance
   */
  setGridStep(step) {
    this.gridStep = Math.max(1, step);
  }
  /**
   * Deep clone a node and all its children
   */
  deepCloneNode(node) {
    return JSON.parse(JSON.stringify(node));
  }
  /**
   * Clone a node with new unique IDs, recursively updating all references
   */
  cloneWithNewIds(node, idMapping) {
    const cloned = this.deepCloneNode(node);
    this.regenerateIds(cloned, idMapping);
    return cloned;
  }
  /**
   * Recursively regenerate IDs for a node and all its children
   */
  regenerateIds(node, idMapping) {
    var _a;
    const oldId = node.id;
    const newId = this.generateId();
    idMapping.set(oldId, newId);
    node.id = newId;
    if (node.children) {
      for (const child of node.children) {
        this.regenerateIds(child, idMapping);
      }
    }
    if ((_a = node.meta) == null ? void 0 : _a.related) {
      node.meta.related = node.meta.related.map((ref) => {
        const mappedId = idMapping.get(ref);
        return mappedId || ref;
      });
    }
  }
  /**
   * Generate a unique node ID
   */
  generateId() {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  /**
   * Calculate bounding box for a set of nodes
   */
  calculateBoundingBox(nodes) {
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
  getNodeBounds(node, offsetX = 0, offsetY = 0) {
    if (node.layout.mode !== "absolute") {
      return { minX: offsetX, minY: offsetY, maxX: offsetX, maxY: offsetY };
    }
    const layout = node.layout;
    const nodeX = offsetX + layout.x;
    const nodeY = offsetY + layout.y;
    let minX = nodeX;
    let minY = nodeY;
    let maxX = nodeX + layout.w;
    let maxY = nodeY + layout.h;
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
  translateNode(node, deltaX, deltaY) {
    if (node.layout.mode === "absolute") {
      const layout = node.layout;
      layout.x += deltaX;
      layout.y += deltaY;
    }
  }
  /**
   * Check if two bounding boxes overlap
   */
  boundingBoxesOverlap(box1, box2) {
    return !(box1.maxX <= box2.minX || box1.minX >= box2.maxX || box1.maxY <= box2.minY || box1.minY >= box2.maxY);
  }
  /**
   * Snap a value to the grid
   */
  snapToGrid(value) {
    return Math.round(value / this.gridStep) * this.gridStep;
  }
  /**
   * Determine the parent node for pasted nodes based on context
   */
  determineParent(_pastedNodes, _cursorX, _cursorY) {
    const screen = this.state.getCurrentScreen();
    return screen == null ? void 0 : screen.root.id;
  }
  /**
   * Copy clipboard data to system clipboard as JSON
   */
  async copyToSystemClipboard(payload) {
    try {
      const json = JSON.stringify(payload);
      await navigator.clipboard.writeText(json);
    } catch (e) {
      console.debug("Could not copy to system clipboard:", e);
    }
  }
  /**
   * Clear the internal clipboard
   */
  clear() {
    this.clipboard = null;
  }
};

// src/canvas/CanvasInteraction.ts
var CanvasInteraction = class {
  constructor(canvas, state, renderer) {
    this.snapEnabled = true;
    this.snapSize = 10;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.boundKeyDownHandler = null;
    this.canvas = canvas;
    this.state = state;
    this.renderer = renderer;
    this.clipboardService = new ClipboardService(state);
    this.drag = {
      mode: "none",
      startX: 0,
      startY: 0,
      startPanX: 0,
      startPanY: 0,
      startNodeX: 0,
      startNodeY: 0,
      startNodeW: 0,
      startNodeH: 0,
      resizeHandle: null,
      selectedNodesStart: []
    };
    this.setupEventListeners();
  }
  setupEventListeners() {
    this.canvas.addEventListener("mousedown", this.onMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.onMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.onMouseUp.bind(this));
    this.canvas.addEventListener("mouseleave", this.onMouseLeave.bind(this));
    this.canvas.addEventListener("wheel", this.onWheel.bind(this), {
      passive: false
    });
    this.canvas.addEventListener("dblclick", this.onDoubleClick.bind(this));
    this.canvas.addEventListener("contextmenu", this.onContextMenu.bind(this));
    this.canvas.tabIndex = 0;
    this.canvas.style.outline = "none";
    const keyHandler = this.onKeyDown.bind(this);
    this.boundKeyDownHandler = keyHandler;
    document.addEventListener("keydown", keyHandler, true);
  }
  getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }
  onMouseDown(e) {
    const coords = this.getCanvasCoords(e);
    this.canvas.focus();
    if (e.button === 1 || e.button === 0 && e.altKey) {
      this.startPan(coords.x, coords.y);
      e.preventDefault();
      return;
    }
    if (e.button === 0) {
      const handle = this.renderer.getHandleAtPosition(coords.x, coords.y);
      if (handle) {
        this.startResize(coords.x, coords.y, handle);
        return;
      }
      const hitNodeId = this.renderer.hitTest(coords.x, coords.y);
      if (hitNodeId) {
        if (e.shiftKey) {
          if (this.state.isNodeSelected(hitNodeId)) {
            this.state.deselectNode(hitNodeId);
          } else {
            this.state.selectNode(hitNodeId, true);
          }
        } else if (!this.state.isNodeSelected(hitNodeId)) {
          this.state.selectNode(hitNodeId);
        }
        if (this.state.isNodeSelected(hitNodeId)) {
          this.startMove(coords.x, coords.y);
        }
      } else {
        this.state.clearSelection();
      }
    }
  }
  onMouseMove(e) {
    const coords = this.getCanvasCoords(e);
    this.lastMouseX = coords.x;
    this.lastMouseY = coords.y;
    switch (this.drag.mode) {
      case "pan":
        this.doPan(coords.x, coords.y);
        break;
      case "move":
        this.doMove(coords.x, coords.y);
        break;
      case "resize":
        this.doResize(coords.x, coords.y);
        break;
      default:
        this.updateHover(coords.x, coords.y);
        this.updateCursor(coords.x, coords.y);
    }
  }
  onMouseUp(e) {
    if (this.drag.mode === "move") {
      this.handleDropReparent(e);
      this.state.endBatch();
    } else if (this.drag.mode === "resize") {
      this.state.endBatch();
    }
    this.drag.mode = "none";
    this.drag.resizeHandle = null;
    this.drag.selectedNodesStart = [];
    this.canvas.style.cursor = "default";
  }
  /**
   * After dropping moved elements, reparent them to the container they're on top of
   */
  handleDropReparent(_e) {
    const selectedIds = this.state.getSelectedNodeIds();
    if (selectedIds.length === 0)
      return;
    for (const nodeId of selectedIds) {
      const node = this.state.findNodeById(nodeId);
      if (!node || node.layout.mode !== "absolute")
        continue;
      const absolutePos = this.state.getAbsolutePosition(nodeId);
      if (!absolutePos)
        continue;
      const nodeCenterX = absolutePos.x + node.layout.w / 2;
      const nodeCenterY = absolutePos.y + node.layout.h / 2;
      const targetContainerId = this.state.findContainerAtPosition(
        nodeCenterX,
        nodeCenterY,
        selectedIds
      );
      if (targetContainerId) {
        this.state.reparentNode(nodeId, targetContainerId);
      }
    }
  }
  onMouseLeave(_e) {
    this.state.setHoveredNode(null);
    if (this.drag.mode !== "none") {
      if (this.drag.mode === "move" || this.drag.mode === "resize") {
        this.state.endBatch();
      }
      this.drag.mode = "none";
      this.drag.selectedNodesStart = [];
    }
  }
  onWheel(e) {
    e.preventDefault();
    const coords = this.getCanvasCoords(e);
    const viewport = this.state.getViewport();
    if (e.ctrlKey) {
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(viewport.zoom * zoomFactor, 0.1), 5);
      const worldX = (coords.x - viewport.panX) / viewport.zoom;
      const worldY = (coords.y - viewport.panY) / viewport.zoom;
      const newPanX = coords.x - worldX * newZoom;
      const newPanY = coords.y - worldY * newZoom;
      this.state.setViewport({
        zoom: newZoom,
        panX: newPanX,
        panY: newPanY
      });
    } else {
      this.state.setViewport({
        panX: viewport.panX - e.deltaX,
        panY: viewport.panY - e.deltaY
      });
    }
  }
  onDoubleClick(e) {
    const coords = this.getCanvasCoords(e);
    const hitNodeId = this.renderer.hitTest(coords.x, coords.y);
    if (!hitNodeId) {
      this.state.setViewport({ panX: 50, panY: 50, zoom: 1 });
    }
  }
  onContextMenu(e) {
    e.preventDefault();
    const coords = this.getCanvasCoords(e);
    this.lastMouseX = coords.x;
    this.lastMouseY = coords.y;
    const hitNodeId = this.renderer.hitTest(coords.x, coords.y);
    if (hitNodeId && !this.state.isNodeSelected(hitNodeId)) {
      this.state.selectNode(hitNodeId);
    }
    const selectedIds = this.state.getSelectedNodeIds();
    const hasSelection = selectedIds.length > 0;
    const hasClipboard = this.hasClipboardContent();
    const menu = new import_obsidian.Menu();
    menu.addItem((item) => {
      item.setTitle("Copy").setIcon("copy").setDisabled(!hasSelection).onClick(() => {
        this.copySelection();
      });
    });
    menu.addItem((item) => {
      item.setTitle("Cut").setIcon("scissors").setDisabled(!hasSelection).onClick(() => {
        this.cutSelection();
      });
    });
    menu.addItem((item) => {
      item.setTitle("Paste").setIcon("clipboard-paste").setDisabled(!hasClipboard).onClick(() => {
        this.pasteAtCursor();
      });
    });
    menu.addSeparator();
    menu.addItem((item) => {
      item.setTitle("Duplicate").setIcon("copy-plus").setDisabled(!hasSelection).onClick(() => {
        this.duplicateSelection();
      });
    });
    menu.addItem((item) => {
      item.setTitle("Delete").setIcon("trash-2").setDisabled(!hasSelection).onClick(() => {
        for (const id of selectedIds) {
          const node = this.state.findNodeById(id);
          if (node && node.id !== "root") {
            this.state.removeNode(id);
          }
        }
      });
    });
    menu.showAtMouseEvent(e);
  }
  onKeyDown(e) {
    if (document.activeElement !== this.canvas) {
      return;
    }
    const selectedIds = this.state.getSelectedNodeIds();
    let handled = false;
    switch (e.key) {
      case "Delete":
      case "Backspace":
        for (const id of selectedIds) {
          const node = this.state.findNodeById(id);
          if (node && node.id !== "root") {
            this.state.removeNode(id);
          }
        }
        handled = true;
        break;
      case "Escape":
        this.state.clearSelection();
        handled = true;
        break;
      case "a":
        if (e.ctrlKey || e.metaKey) {
          const allNodes = this.state.getAllNodes();
          for (const node of allNodes) {
            if (node.id !== "root") {
              this.state.selectNode(node.id, true);
            }
          }
          handled = true;
        }
        break;
      case "c":
        if (e.ctrlKey || e.metaKey) {
          this.copySelection();
          handled = true;
        }
        break;
      case "x":
        if (e.ctrlKey || e.metaKey) {
          this.cutSelection();
          handled = true;
        }
        break;
      case "v":
        if (e.ctrlKey || e.metaKey) {
          this.pasteAtCursor();
          handled = true;
        }
        break;
      case "d":
        if (e.ctrlKey || e.metaKey) {
          this.duplicateSelection();
          handled = true;
        }
        break;
      case "z":
        if (e.ctrlKey || e.metaKey) {
          if (e.shiftKey) {
            this.state.redo();
          } else {
            this.state.undo();
          }
          handled = true;
        }
        break;
      case "y":
        if (e.ctrlKey || e.metaKey) {
          this.state.redo();
          handled = true;
        }
        break;
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
  // Drag operations
  startPan(x, y) {
    const viewport = this.state.getViewport();
    this.drag = {
      mode: "pan",
      startX: x,
      startY: y,
      startPanX: viewport.panX,
      startPanY: viewport.panY,
      startNodeX: 0,
      startNodeY: 0,
      startNodeW: 0,
      startNodeH: 0,
      resizeHandle: null,
      selectedNodesStart: []
    };
    this.canvas.style.cursor = "grabbing";
  }
  doPan(x, y) {
    const dx = x - this.drag.startX;
    const dy = y - this.drag.startY;
    this.state.setViewport({
      panX: this.drag.startPanX + dx,
      panY: this.drag.startPanY + dy
    });
  }
  startMove(x, y) {
    const selectedIds = this.state.getSelectedNodeIds();
    if (selectedIds.length === 0)
      return;
    const selectedNodesStart = [];
    for (const id of selectedIds) {
      const node = this.state.findNodeById(id);
      if (node && node.layout.mode === "absolute") {
        selectedNodesStart.push({
          id: node.id,
          x: node.layout.x,
          y: node.layout.y,
          w: node.layout.w,
          h: node.layout.h
        });
      }
    }
    if (selectedNodesStart.length === 0)
      return;
    this.state.startBatch("Move");
    const firstNode = selectedNodesStart[0];
    this.drag = {
      mode: "move",
      startX: x,
      startY: y,
      startPanX: 0,
      startPanY: 0,
      startNodeX: firstNode.x,
      startNodeY: firstNode.y,
      startNodeW: firstNode.w,
      startNodeH: firstNode.h,
      resizeHandle: null,
      selectedNodesStart
    };
    this.canvas.style.cursor = "move";
  }
  doMove(x, y) {
    if (this.drag.selectedNodesStart.length === 0)
      return;
    const viewport = this.state.getViewport();
    const dx = (x - this.drag.startX) / viewport.zoom;
    const dy = (y - this.drag.startY) / viewport.zoom;
    for (const startPos of this.drag.selectedNodesStart) {
      const node = this.state.findNodeById(startPos.id);
      if (!node || node.layout.mode !== "absolute")
        continue;
      this.state.updateNodeLayout(startPos.id, {
        mode: "absolute",
        x: this.snap(startPos.x + dx),
        y: this.snap(startPos.y + dy),
        w: startPos.w,
        h: startPos.h
      });
    }
  }
  startResize(x, y, handle) {
    const node = this.state.getSelectedNode();
    if (!node || node.layout.mode !== "absolute")
      return;
    this.state.startBatch("Resize");
    this.drag = {
      mode: "resize",
      startX: x,
      startY: y,
      startPanX: 0,
      startPanY: 0,
      startNodeX: node.layout.x,
      startNodeY: node.layout.y,
      startNodeW: node.layout.w,
      startNodeH: node.layout.h,
      resizeHandle: handle,
      selectedNodesStart: []
    };
    this.updateResizeCursor(handle);
  }
  doResize(x, y) {
    const node = this.state.getSelectedNode();
    if (!node || node.layout.mode !== "absolute" || !this.drag.resizeHandle)
      return;
    const viewport = this.state.getViewport();
    const dx = (x - this.drag.startX) / viewport.zoom;
    const dy = (y - this.drag.startY) / viewport.zoom;
    let newX = this.drag.startNodeX;
    let newY = this.drag.startNodeY;
    let newW = this.drag.startNodeW;
    let newH = this.drag.startNodeH;
    const handle = this.drag.resizeHandle;
    if (handle.includes("e")) {
      newW = Math.max(20, this.drag.startNodeW + dx);
    }
    if (handle.includes("w")) {
      const maxDx = this.drag.startNodeW - 20;
      const clampedDx = Math.min(dx, maxDx);
      newX = this.drag.startNodeX + clampedDx;
      newW = this.drag.startNodeW - clampedDx;
    }
    if (handle.includes("s")) {
      newH = Math.max(20, this.drag.startNodeH + dy);
    }
    if (handle.includes("n")) {
      const maxDy = this.drag.startNodeH - 20;
      const clampedDy = Math.min(dy, maxDy);
      newY = this.drag.startNodeY + clampedDy;
      newH = this.drag.startNodeH - clampedDy;
    }
    this.state.updateNodeLayout(node.id, {
      mode: "absolute",
      x: this.snap(newX),
      y: this.snap(newY),
      w: this.snap(newW),
      h: this.snap(newH)
    });
  }
  updateHover(x, y) {
    const hitNodeId = this.renderer.hitTest(x, y);
    this.state.setHoveredNode(hitNodeId);
  }
  updateCursor(x, y) {
    const handle = this.renderer.getHandleAtPosition(x, y);
    if (handle) {
      this.updateResizeCursor(handle);
    } else {
      const hitNodeId = this.renderer.hitTest(x, y);
      this.canvas.style.cursor = hitNodeId ? "pointer" : "default";
    }
  }
  updateResizeCursor(handle) {
    const cursorMap = {
      nw: "nwse-resize",
      se: "nwse-resize",
      ne: "nesw-resize",
      sw: "nesw-resize",
      n: "ns-resize",
      s: "ns-resize",
      e: "ew-resize",
      w: "ew-resize"
    };
    this.canvas.style.cursor = cursorMap[handle] || "default";
  }
  // Snap value to grid
  snap(value) {
    if (!this.snapEnabled)
      return Math.round(value);
    return Math.round(value / this.snapSize) * this.snapSize;
  }
  // Toggle snap on/off
  setSnapEnabled(enabled) {
    this.snapEnabled = enabled;
  }
  // Set snap grid size
  setSnapSize(size) {
    this.snapSize = Math.max(1, size);
  }
  isSnapEnabled() {
    return this.snapEnabled;
  }
  // Public method to add a new node
  addNode(type) {
    const viewport = this.state.getViewport();
    const canvasRect = this.canvas.getBoundingClientRect();
    const centerX = (canvasRect.width / 2 - viewport.panX) / viewport.zoom;
    const centerY = (canvasRect.height / 2 - viewport.panY) / viewport.zoom;
    const node = createNode(type, {
      layout: {
        mode: "absolute",
        x: Math.round(centerX - 50),
        y: Math.round(centerY - 25),
        w: type === "Button" ? 120 : 200,
        h: type === "Button" ? 40 : 100
      }
    });
    this.state.addNode(node);
    this.state.selectNode(node.id);
  }
  // Clipboard operations
  /**
   * Copy selected nodes to clipboard
   * Returns true if any nodes were copied
   */
  copySelection() {
    return this.clipboardService.copy();
  }
  /**
   * Cut selected nodes (copy then delete)
   * Returns true if any nodes were cut
   */
  cutSelection() {
    const selectedIds = this.state.getSelectedNodeIds();
    if (selectedIds.length === 0) {
      return false;
    }
    if (!this.clipboardService.copy()) {
      return false;
    }
    for (const id of selectedIds) {
      const node = this.state.findNodeById(id);
      if (node && node.id !== "root") {
        this.state.removeNode(id);
      }
    }
    return true;
  }
  /**
   * Paste nodes at the current cursor position
   * Returns array of pasted node IDs, or null if paste failed
   */
  pasteAtCursor() {
    const viewport = this.state.getViewport();
    const worldX = (this.lastMouseX - viewport.panX) / viewport.zoom;
    const worldY = (this.lastMouseY - viewport.panY) / viewport.zoom;
    return this.clipboardService.paste(worldX, worldY);
  }
  /**
   * Paste nodes at a specific world position
   * Returns array of pasted node IDs, or null if paste failed
   */
  pasteAtPosition(worldX, worldY) {
    return this.clipboardService.paste(worldX, worldY);
  }
  /**
   * Duplicate selected nodes with a fixed offset
   * Returns array of duplicated node IDs, or null if duplication failed
   */
  duplicateSelection() {
    return this.clipboardService.duplicate();
  }
  /**
   * Check if clipboard has content
   */
  hasClipboardContent() {
    return this.clipboardService.hasContent();
  }
  /**
   * Get the clipboard service for external access
   */
  getClipboardService() {
    return this.clipboardService;
  }
  destroy() {
    if (this.boundKeyDownHandler) {
      document.removeEventListener("keydown", this.boundKeyDownHandler, true);
      this.boundKeyDownHandler = null;
    }
  }
};

// src/views/UIEditorView.ts
var UI_EDITOR_VIEW_TYPE = "ui-editor-view";
var UIEditorView = class extends import_obsidian2.TextFileView {
  constructor(leaf) {
    super(leaf);
    this.state = null;
    this.canvas = null;
    this.renderer = null;
    this.interaction = null;
    this.dirtyHandler = null;
  }
  /**
   * Get the state for this view (creates one tied to the file path)
   */
  ensureState() {
    if (!this.state && this.file) {
      this.state = getEditorStateManager().getStateForFile(this.file.path);
    }
    if (!this.state) {
      this.state = getEditorStateManager().getStateForFile("__temp__");
    }
    return this.state;
  }
  /**
   * Get the EditorState for external access (e.g., clipboard commands)
   */
  getEditorState() {
    return this.ensureState();
  }
  getViewType() {
    return UI_EDITOR_VIEW_TYPE;
  }
  getDisplayText() {
    var _a;
    return ((_a = this.file) == null ? void 0 : _a.basename) || "UI Editor";
  }
  getIcon() {
    return "layout";
  }
  async onOpen() {
    const container = this.contentEl;
    container.empty();
    container.addClass("ui-editor-container");
    const toolbar = container.createDiv({ cls: "ui-editor-toolbar" });
    this.createToolbar(toolbar);
    const canvasContainer = container.createDiv({
      cls: "ui-editor-canvas-container"
    });
    this.canvas = canvasContainer.createEl("canvas", {
      cls: "ui-editor-canvas"
    });
  }
  /**
   * Initialize or reinitialize renderer and interaction with current state
   */
  initializeCanvas() {
    var _a, _b;
    if (!this.canvas)
      return;
    (_a = this.renderer) == null ? void 0 : _a.destroy();
    (_b = this.interaction) == null ? void 0 : _b.destroy();
    if (this.dirtyHandler && this.state) {
      this.state.off("dirty-changed", this.dirtyHandler);
    }
    const state = this.ensureState();
    this.renderer = new CanvasRenderer(this.canvas, state);
    this.interaction = new CanvasInteraction(
      this.canvas,
      state,
      this.renderer
    );
    this.dirtyHandler = (isDirty) => {
      if (isDirty) {
        this.requestSave();
      }
    };
    state.on("dirty-changed", this.dirtyHandler);
  }
  async onClose() {
    var _a, _b;
    if (this.dirtyHandler && this.state) {
      this.state.off("dirty-changed", this.dirtyHandler);
      this.dirtyHandler = null;
    }
    (_a = this.renderer) == null ? void 0 : _a.destroy();
    (_b = this.interaction) == null ? void 0 : _b.destroy();
    this.canvas = null;
    this.renderer = null;
    this.interaction = null;
    this.state = null;
  }
  createToolbar(container) {
    const nodeTypes = [
      { type: "Container", label: "Container" },
      { type: "Button", label: "Button" },
      { type: "Text", label: "Text" },
      { type: "Input", label: "Input" },
      { type: "Image", label: "Image" }
    ];
    const addGroup = container.createDiv({ cls: "ui-editor-toolbar-group" });
    addGroup.createSpan({ text: "Add:", cls: "ui-editor-toolbar-label" });
    for (const { type, label } of nodeTypes) {
      const btn = addGroup.createEl("button", {
        cls: "ui-editor-toolbar-btn",
        attr: { title: `Add ${label}` }
      });
      btn.textContent = label;
      btn.addEventListener("click", () => {
        var _a;
        (_a = this.interaction) == null ? void 0 : _a.addNode(type);
      });
    }
    container.createDiv({ cls: "ui-editor-toolbar-separator" });
    const viewGroup = container.createDiv({ cls: "ui-editor-toolbar-group" });
    const resetViewBtn = viewGroup.createEl("button", {
      cls: "ui-editor-toolbar-btn",
      attr: { title: "Reset View" }
    });
    resetViewBtn.textContent = "Reset View";
    resetViewBtn.addEventListener("click", () => {
      this.ensureState().setViewport({ panX: 50, panY: 50, zoom: 1 });
    });
    const zoomInBtn = viewGroup.createEl("button", {
      cls: "ui-editor-toolbar-btn",
      attr: { title: "Zoom In" }
    });
    zoomInBtn.textContent = "+";
    zoomInBtn.addEventListener("click", () => {
      const state = this.ensureState();
      const viewport = state.getViewport();
      state.setViewport({ zoom: Math.min(viewport.zoom * 1.2, 5) });
    });
    const zoomOutBtn = viewGroup.createEl("button", {
      cls: "ui-editor-toolbar-btn",
      attr: { title: "Zoom Out" }
    });
    zoomOutBtn.textContent = "-";
    zoomOutBtn.addEventListener("click", () => {
      const state = this.ensureState();
      const viewport = state.getViewport();
      state.setViewport({ zoom: Math.max(viewport.zoom / 1.2, 0.1) });
    });
    container.createDiv({ cls: "ui-editor-toolbar-separator" });
    const snapGroup = container.createDiv({ cls: "ui-editor-toolbar-group" });
    const snapBtn = snapGroup.createEl("button", {
      cls: "ui-editor-toolbar-btn ui-editor-toolbar-btn-toggle is-active",
      attr: { title: "Toggle Snap to Grid" }
    });
    snapBtn.textContent = "Snap: On";
    snapBtn.addEventListener("click", () => {
      if (this.interaction) {
        const newState = !this.interaction.isSnapEnabled();
        this.interaction.setSnapEnabled(newState);
        snapBtn.textContent = newState ? "Snap: On" : "Snap: Off";
        snapBtn.toggleClass("is-active", newState);
      }
    });
  }
  // TextFileView methods
  getViewData() {
    return this.ensureState().serialize();
  }
  setViewData(data, clear) {
    var _a, _b;
    if (clear) {
      this.clear();
    }
    const state = this.ensureState();
    if (this.file) {
      getEditorStateManager().setActiveFile(this.file.path);
    }
    try {
      let doc;
      if (!data || data.trim() === "") {
        doc = state.createNewDocument((_a = this.file) == null ? void 0 : _a.basename);
      } else {
        doc = JSON.parse(data);
        if (!doc.tokens)
          doc.tokens = {};
        if (!doc.components)
          doc.components = {};
        if (!doc.screens)
          doc.screens = {};
        if (Object.keys(doc.screens).length === 0) {
          doc.screens["main"] = {
            id: "main",
            name: "Main Screen",
            root: {
              id: "root",
              type: "Container",
              name: "Root",
              layout: { mode: "absolute", x: 0, y: 0, w: 375, h: 667 },
              style: { background: "#ffffff" },
              children: []
            }
          };
        }
      }
      state.loadDocument(doc, this.file);
      state.setViewport({ panX: 50, panY: 50, zoom: 1 });
      this.initializeCanvas();
    } catch (e) {
      console.error("Failed to parse UI document:", e);
      const doc = state.createNewDocument((_b = this.file) == null ? void 0 : _b.basename);
      state.loadDocument(doc, this.file);
      this.initializeCanvas();
    }
  }
  clear() {
    this.ensureState().clearSelection();
  }
  onPaneMenu(menu, source) {
    super.onPaneMenu(menu, source);
    menu.addItem((item) => {
      item.setTitle("Reset View").setIcon("refresh-cw").onClick(() => {
        this.ensureState().setViewport({ panX: 50, panY: 50, zoom: 1 });
      });
    });
  }
  /**
   * Get the canvas interaction handler for clipboard operations
   */
  getInteraction() {
    return this.interaction;
  }
};

// src/views/NodeTreeView.ts
var import_obsidian3 = require("obsidian");
var NODE_TREE_VIEW_TYPE = "ui-node-tree-view";
var NodeTreeView = class extends import_obsidian3.ItemView {
  constructor(leaf) {
    super(leaf);
    this.state = null;
    this.treeContainer = null;
    this.stateEventHandlers = /* @__PURE__ */ new Map();
    this.activeStateChangedHandler = null;
  }
  /**
   * Subscribe to events on the current state
   */
  subscribeToState(state) {
    this.unsubscribeFromState();
    this.state = state;
    if (!state) {
      this.refresh();
      return;
    }
    const refreshHandler = () => this.refresh();
    const selectionHandler = () => this.updateSelection();
    this.stateEventHandlers.set("document-loaded", refreshHandler);
    this.stateEventHandlers.set("screen-changed", refreshHandler);
    this.stateEventHandlers.set("node-added", refreshHandler);
    this.stateEventHandlers.set("node-removed", refreshHandler);
    this.stateEventHandlers.set("node-updated", refreshHandler);
    this.stateEventHandlers.set("selection-changed", selectionHandler);
    state.on("document-loaded", refreshHandler);
    state.on("screen-changed", refreshHandler);
    state.on("node-added", refreshHandler);
    state.on("node-removed", refreshHandler);
    state.on("node-updated", refreshHandler);
    state.on("selection-changed", selectionHandler);
    this.refresh();
  }
  /**
   * Unsubscribe from current state's events
   */
  unsubscribeFromState() {
    if (!this.state)
      return;
    for (const [event, handler] of this.stateEventHandlers) {
      this.state.off(event, handler);
    }
    this.stateEventHandlers.clear();
  }
  getViewType() {
    return NODE_TREE_VIEW_TYPE;
  }
  getDisplayText() {
    return "UI Hierarchy";
  }
  getIcon() {
    return "list-tree";
  }
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("ui-node-tree-container");
    const header = container.createDiv({ cls: "ui-node-tree-header" });
    header.createSpan({ text: "Node Tree", cls: "ui-node-tree-title" });
    this.treeContainer = container.createDiv({ cls: "ui-node-tree-content" });
    const manager = getEditorStateManager();
    this.activeStateChangedHandler = (state) => {
      this.subscribeToState(state);
    };
    manager.on("active-state-changed", this.activeStateChangedHandler);
    this.subscribeToState(manager.getActiveState());
  }
  async onClose() {
    this.unsubscribeFromState();
    if (this.activeStateChangedHandler) {
      getEditorStateManager().off("active-state-changed", this.activeStateChangedHandler);
      this.activeStateChangedHandler = null;
    }
    this.treeContainer = null;
  }
  refresh() {
    if (!this.treeContainer)
      return;
    this.treeContainer.empty();
    if (!this.state) {
      this.treeContainer.createSpan({
        text: "No document loaded",
        cls: "ui-node-tree-empty"
      });
      return;
    }
    const screen = this.state.getCurrentScreen();
    if (!screen) {
      this.treeContainer.createSpan({
        text: "No document loaded",
        cls: "ui-node-tree-empty"
      });
      return;
    }
    const doc = this.state.getDocument();
    if (doc && Object.keys(doc.screens).length > 1) {
      const screenSelect = this.treeContainer.createEl("select", {
        cls: "ui-node-tree-screen-select"
      });
      for (const [id, scr] of Object.entries(doc.screens)) {
        const option = screenSelect.createEl("option", {
          value: id,
          text: scr.name || id
        });
        if (id === screen.id) {
          option.selected = true;
        }
      }
      screenSelect.addEventListener("change", () => {
        var _a;
        (_a = this.state) == null ? void 0 : _a.setCurrentScreen(screenSelect.value);
      });
    }
    const treeRoot = this.treeContainer.createDiv({ cls: "ui-node-tree-root" });
    this.renderNode(screen.root, treeRoot, 0);
  }
  renderNode(node, container, depth) {
    if (!this.state)
      return;
    const isSelected = this.state.isNodeSelected(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const nodeEl = container.createDiv({
      cls: `ui-node-tree-item ${isSelected ? "is-selected" : ""}`,
      attr: { "data-node-id": node.id }
    });
    nodeEl.style.paddingLeft = `${depth * 16 + 8}px`;
    if (hasChildren) {
      const toggle = nodeEl.createSpan({ cls: "ui-node-tree-toggle" });
      toggle.textContent = "\u25BC";
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const childContainer = nodeEl.nextElementSibling;
        if (childContainer == null ? void 0 : childContainer.hasClass("ui-node-tree-children")) {
          const isCollapsed = childContainer.hasClass("is-collapsed");
          childContainer.toggleClass("is-collapsed", !isCollapsed);
          toggle.textContent = isCollapsed ? "\u25BC" : "\u25B6";
        }
      });
    } else {
      nodeEl.createSpan({ cls: "ui-node-tree-toggle-spacer" });
    }
    const icon = this.getNodeIcon(node.type);
    nodeEl.createSpan({ text: icon, cls: "ui-node-tree-icon" });
    const name = node.name || node.type;
    nodeEl.createSpan({ text: name, cls: "ui-node-tree-name" });
    nodeEl.addEventListener("click", (e) => {
      if (!this.state)
        return;
      const addToSelection = e.shiftKey || e.ctrlKey || e.metaKey;
      if (addToSelection && this.state.isNodeSelected(node.id)) {
        this.state.deselectNode(node.id);
      } else {
        this.state.selectNode(node.id, addToSelection);
      }
    });
    nodeEl.addEventListener("dblclick", () => {
    });
    if (hasChildren) {
      const childContainer = container.createDiv({
        cls: "ui-node-tree-children"
      });
      for (const child of node.children) {
        this.renderNode(child, childContainer, depth + 1);
      }
    }
  }
  getNodeIcon(type) {
    const icons = {
      Container: "\u25A1",
      Button: "\u25A3",
      Text: "T",
      Input: "\u25AD",
      Image: "\u25A8",
      Icon: "\u25C9",
      Divider: "\u2014",
      Spacer: "\u22EE",
      Card: "\u25A2",
      List: "\u2630",
      ListItem: "\u2022",
      Header: "\u2594",
      Footer: "\u2581",
      Sidebar: "\u258C",
      Modal: "\u25EB",
      Custom: "\u2727"
    };
    return icons[type] || "\u25CB";
  }
  updateSelection() {
    if (!this.treeContainer || !this.state)
      return;
    const selectedIds = new Set(this.state.getSelectedNodeIds());
    this.treeContainer.querySelectorAll(".ui-node-tree-item").forEach((el) => {
      const nodeId = el.getAttribute("data-node-id");
      if (nodeId) {
        el.toggleClass("is-selected", selectedIds.has(nodeId));
      }
    });
  }
};

// src/views/PropertiesView.ts
var import_obsidian4 = require("obsidian");
var PROPERTIES_VIEW_TYPE = "ui-properties-view";
var PropertiesView = class extends import_obsidian4.ItemView {
  constructor(leaf) {
    super(leaf);
    this.state = null;
    this.contentContainer = null;
    this.stateEventHandlers = /* @__PURE__ */ new Map();
    this.activeStateChangedHandler = null;
  }
  /**
   * Subscribe to events on the current state
   */
  subscribeToState(state) {
    this.unsubscribeFromState();
    this.state = state;
    if (!state) {
      this.refresh();
      return;
    }
    const refreshHandler = () => this.refresh();
    this.stateEventHandlers.set("selection-changed", refreshHandler);
    this.stateEventHandlers.set("node-updated", refreshHandler);
    state.on("selection-changed", refreshHandler);
    state.on("node-updated", refreshHandler);
    this.refresh();
  }
  /**
   * Unsubscribe from current state's events
   */
  unsubscribeFromState() {
    if (!this.state)
      return;
    for (const [event, handler] of this.stateEventHandlers) {
      this.state.off(event, handler);
    }
    this.stateEventHandlers.clear();
  }
  getViewType() {
    return PROPERTIES_VIEW_TYPE;
  }
  getDisplayText() {
    return "Properties";
  }
  getIcon() {
    return "sliders-horizontal";
  }
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("ui-properties-container");
    const header = container.createDiv({ cls: "ui-properties-header" });
    header.createSpan({ text: "Properties", cls: "ui-properties-title" });
    this.contentContainer = container.createDiv({
      cls: "ui-properties-content"
    });
    const manager = getEditorStateManager();
    this.activeStateChangedHandler = (state) => {
      this.subscribeToState(state);
    };
    manager.on("active-state-changed", this.activeStateChangedHandler);
    this.subscribeToState(manager.getActiveState());
  }
  async onClose() {
    this.unsubscribeFromState();
    if (this.activeStateChangedHandler) {
      getEditorStateManager().off("active-state-changed", this.activeStateChangedHandler);
      this.activeStateChangedHandler = null;
    }
    this.contentContainer = null;
  }
  refresh() {
    if (!this.contentContainer)
      return;
    this.contentContainer.empty();
    const state = this.state;
    if (!state) {
      this.contentContainer.createSpan({
        text: "No document loaded",
        cls: "ui-properties-empty"
      });
      return;
    }
    const selectedNode = state.getSelectedNode();
    if (!selectedNode) {
      this.contentContainer.createSpan({
        text: "No node selected",
        cls: "ui-properties-empty"
      });
      return;
    }
    this.createSection("Node", this.contentContainer, (section) => {
      this.createTextField(section, "Name", selectedNode.name || "", (val) => {
        state.updateNode(selectedNode.id, { name: val });
      });
      this.createReadOnlyField(section, "Type", selectedNode.type);
      this.createReadOnlyField(section, "ID", selectedNode.id);
    });
    if (selectedNode.layout.mode === "absolute") {
      const absLayout = selectedNode.layout;
      this.createSection("Layout", this.contentContainer, (section) => {
        this.createNumberField(section, "X", absLayout.x, (val) => {
          state.updateNodeLayout(selectedNode.id, { ...absLayout, x: val });
        });
        this.createNumberField(section, "Y", absLayout.y, (val) => {
          state.updateNodeLayout(selectedNode.id, { ...absLayout, y: val });
        });
        this.createNumberField(section, "Width", absLayout.w, (val) => {
          state.updateNodeLayout(selectedNode.id, { ...absLayout, w: val });
        });
        this.createNumberField(section, "Height", absLayout.h, (val) => {
          state.updateNodeLayout(selectedNode.id, { ...absLayout, h: val });
        });
      });
    }
    this.createSection("Style", this.contentContainer, (section) => {
      const style = selectedNode.style || {};
      this.createColorField(
        section,
        "Background",
        style.background || "",
        (val) => {
          state.updateNodeStyle(selectedNode.id, { background: val });
        }
      );
      this.createColorField(
        section,
        "Text Color",
        style.textColor || "",
        (val) => {
          state.updateNodeStyle(selectedNode.id, { textColor: val });
        }
      );
      this.createColorField(
        section,
        "Border Color",
        style.borderColor || "",
        (val) => {
          state.updateNodeStyle(selectedNode.id, { borderColor: val });
        }
      );
      this.createNumberField(
        section,
        "Border Width",
        style.borderWidth || 0,
        (val) => {
          state.updateNodeStyle(selectedNode.id, { borderWidth: val });
        }
      );
      this.createNumberField(
        section,
        "Border Radius",
        style.borderRadius || 0,
        (val) => {
          state.updateNodeStyle(selectedNode.id, { borderRadius: val });
        }
      );
      this.createNumberField(
        section,
        "Opacity",
        style.opacity !== void 0 ? style.opacity : 1,
        (val) => {
          state.updateNodeStyle(selectedNode.id, {
            opacity: Math.min(1, Math.max(0, val))
          });
        }
      );
    });
    this.createSection("Content", this.contentContainer, (section) => {
      const content = selectedNode.content || {};
      this.createTextField(section, "Text", content.text || "", (val) => {
        state.updateNode(selectedNode.id, {
          content: { ...content, text: val }
        });
      });
      this.createTextField(section, "Icon", content.icon || "", (val) => {
        state.updateNode(selectedNode.id, {
          content: { ...content, icon: val }
        });
      });
      if (selectedNode.type === "Input") {
        this.createTextField(
          section,
          "Placeholder",
          content.placeholder || "",
          (val) => {
            state.updateNode(selectedNode.id, {
              content: { ...content, placeholder: val }
            });
          }
        );
      }
      if (selectedNode.type === "Image") {
        this.createTextField(section, "Source", content.src || "", (val) => {
          state.updateNode(selectedNode.id, {
            content: { ...content, src: val }
          });
        });
      }
    });
    this.createSection("Meta", this.contentContainer, (section) => {
      const meta = selectedNode.meta || {};
      this.createTextAreaField(section, "Purpose", meta.purpose || "", (val) => {
        state.updateNode(selectedNode.id, {
          meta: { ...meta, purpose: val }
        });
      });
      this.createTextAreaField(
        section,
        "Behavior",
        meta.behavior || "",
        (val) => {
          state.updateNode(selectedNode.id, {
            meta: { ...meta, behavior: val }
          });
        }
      );
      this.createTextField(
        section,
        "States",
        (meta.states || []).join(", "),
        (val) => {
          const states = val.split(",").map((s) => s.trim()).filter((s) => s);
          state.updateNode(selectedNode.id, {
            meta: { ...meta, states }
          });
        }
      );
      this.createTextAreaField(section, "Notes", meta.notes || "", (val) => {
        state.updateNode(selectedNode.id, {
          meta: { ...meta, notes: val }
        });
      });
      this.createTextField(
        section,
        "Related",
        (meta.related || []).join(", "),
        (val) => {
          const related = val.split(",").map((s) => s.trim()).filter((s) => s);
          state.updateNode(selectedNode.id, {
            meta: { ...meta, related }
          });
        }
      );
    });
  }
  createSection(title, parent, buildContent) {
    const section = parent.createDiv({ cls: "ui-properties-section" });
    const header = section.createDiv({ cls: "ui-properties-section-header" });
    const toggle = header.createSpan({
      text: "\u25BC",
      cls: "ui-properties-section-toggle"
    });
    header.createSpan({ text: title, cls: "ui-properties-section-title" });
    const content = section.createDiv({ cls: "ui-properties-section-content" });
    buildContent(content);
    header.addEventListener("click", () => {
      const isCollapsed = content.hasClass("is-collapsed");
      content.toggleClass("is-collapsed", !isCollapsed);
      toggle.textContent = isCollapsed ? "\u25BC" : "\u25B6";
    });
  }
  createTextField(parent, label, value, onChange) {
    const row = parent.createDiv({ cls: "ui-properties-row" });
    row.createSpan({ text: label, cls: "ui-properties-label" });
    const input = row.createEl("input", {
      type: "text",
      value,
      cls: "ui-properties-input"
    });
    input.addEventListener("change", () => {
      onChange(input.value);
    });
  }
  createNumberField(parent, label, value, onChange) {
    const row = parent.createDiv({ cls: "ui-properties-row" });
    row.createSpan({ text: label, cls: "ui-properties-label" });
    const input = row.createEl("input", {
      type: "number",
      value: String(value),
      cls: "ui-properties-input ui-properties-input-number"
    });
    input.addEventListener("change", () => {
      const num = parseFloat(input.value);
      if (!isNaN(num)) {
        onChange(num);
      }
    });
  }
  createColorField(parent, label, value, onChange) {
    const row = parent.createDiv({ cls: "ui-properties-row" });
    row.createSpan({ text: label, cls: "ui-properties-label" });
    const inputGroup = row.createDiv({ cls: "ui-properties-color-group" });
    const colorInput = inputGroup.createEl("input", {
      type: "color",
      cls: "ui-properties-color-picker"
    });
    const textInput = inputGroup.createEl("input", {
      type: "text",
      value,
      cls: "ui-properties-input ui-properties-color-text",
      attr: { placeholder: "#000000 or token" }
    });
    const hexMatch = value.match(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/);
    if (hexMatch) {
      colorInput.value = value;
    } else {
      colorInput.value = "#000000";
    }
    colorInput.addEventListener("input", () => {
      textInput.value = colorInput.value;
      onChange(colorInput.value);
    });
    textInput.addEventListener("change", () => {
      const val = textInput.value;
      if (/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(val)) {
        colorInput.value = val;
      }
      onChange(val);
    });
  }
  createTextAreaField(parent, label, value, onChange) {
    const row = parent.createDiv({ cls: "ui-properties-row ui-properties-row-vertical" });
    row.createSpan({ text: label, cls: "ui-properties-label" });
    const textarea = row.createEl("textarea", {
      cls: "ui-properties-textarea"
    });
    textarea.value = value;
    textarea.addEventListener("change", () => {
      onChange(textarea.value);
    });
  }
  createReadOnlyField(parent, label, value) {
    const row = parent.createDiv({ cls: "ui-properties-row" });
    row.createSpan({ text: label, cls: "ui-properties-label" });
    row.createSpan({ text: value, cls: "ui-properties-value-readonly" });
  }
};

// src/main.ts
var UIDesignerPlugin = class extends import_obsidian5.Plugin {
  async onload() {
    this.registerView(
      UI_EDITOR_VIEW_TYPE,
      (leaf) => new UIEditorView(leaf)
    );
    this.registerView(
      NODE_TREE_VIEW_TYPE,
      (leaf) => new NodeTreeView(leaf)
    );
    this.registerView(
      PROPERTIES_VIEW_TYPE,
      (leaf) => new PropertiesView(leaf)
    );
    this.registerExtensions(["uidesign"], UI_EDITOR_VIEW_TYPE);
    this.addRibbonIcon("layout", "Create UI Design", () => {
      this.createNewUIFile().catch((e) => {
        console.error("UI Designer: Failed to create file", e);
      });
    });
    this.addCommand({
      id: "create-ui-file",
      name: "Create new UI design file",
      callback: () => this.createNewUIFile()
    });
    this.addCommand({
      id: "open-node-tree",
      name: "Open node tree panel",
      callback: () => this.activateView(NODE_TREE_VIEW_TYPE, "left")
    });
    this.addCommand({
      id: "open-properties",
      name: "Open properties panel",
      callback: () => this.activateView(PROPERTIES_VIEW_TYPE, "right")
    });
    this.addCommand({
      id: "copy-selection",
      name: "Copy selected components",
      checkCallback: (checking) => {
        const uiView = this.getActiveUIEditorView();
        if (!uiView)
          return false;
        const interaction = uiView.getInteraction();
        const state = uiView.getEditorState();
        const hasSelection = state.getSelectedNodeIds().length > 0;
        if (checking) {
          return hasSelection;
        }
        if (interaction && hasSelection) {
          interaction.copySelection();
        }
        return true;
      }
    });
    this.addCommand({
      id: "cut-selection",
      name: "Cut selected components",
      checkCallback: (checking) => {
        const uiView = this.getActiveUIEditorView();
        if (!uiView)
          return false;
        const interaction = uiView.getInteraction();
        const state = uiView.getEditorState();
        const hasSelection = state.getSelectedNodeIds().length > 0;
        if (checking) {
          return hasSelection;
        }
        if (interaction && hasSelection) {
          interaction.cutSelection();
        }
        return true;
      }
    });
    this.addCommand({
      id: "paste-components",
      name: "Paste components",
      checkCallback: (checking) => {
        var _a;
        const uiView = this.getActiveUIEditorView();
        if (!uiView)
          return false;
        const interaction = uiView.getInteraction();
        if (checking) {
          return (_a = interaction == null ? void 0 : interaction.hasClipboardContent()) != null ? _a : false;
        }
        if (interaction) {
          interaction.pasteAtCursor();
        }
        return true;
      }
    });
    this.addCommand({
      id: "duplicate-selection",
      name: "Duplicate selected components",
      checkCallback: (checking) => {
        const uiView = this.getActiveUIEditorView();
        if (!uiView)
          return false;
        const interaction = uiView.getInteraction();
        const state = uiView.getEditorState();
        const hasSelection = state.getSelectedNodeIds().length > 0;
        if (checking) {
          return hasSelection;
        }
        if (interaction && hasSelection) {
          interaction.duplicateSelection();
        }
        return true;
      }
    });
    this.addCommand({
      id: "undo",
      name: "Undo",
      checkCallback: (checking) => {
        const uiView = this.getActiveUIEditorView();
        if (!uiView)
          return false;
        const state = uiView.getEditorState();
        if (checking) {
          return state.canUndo();
        }
        state.undo();
        return true;
      }
    });
    this.addCommand({
      id: "redo",
      name: "Redo",
      checkCallback: (checking) => {
        const uiView = this.getActiveUIEditorView();
        if (!uiView)
          return false;
        const state = uiView.getEditorState();
        if (checking) {
          return state.canRedo();
        }
        state.redo();
        return true;
      }
    });
    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(
        this.app.workspace.on("active-leaf-change", (leaf) => {
          if ((leaf == null ? void 0 : leaf.view.getViewType()) === UI_EDITOR_VIEW_TYPE) {
            const uiView = leaf.view;
            if (uiView.file) {
              getEditorStateManager().setActiveFile(uiView.file.path);
            }
            this.ensurePanelsOpen();
          } else {
            const hasActiveUIEditor = this.app.workspace.getLeavesOfType(UI_EDITOR_VIEW_TYPE).some((l) => l === this.app.workspace.getLeaf());
            if (!hasActiveUIEditor) {
              getEditorStateManager().setActiveFile(null);
            }
          }
        })
      );
    });
  }
  onunload() {
    resetEditorStateManager();
    this.app.workspace.detachLeavesOfType(UI_EDITOR_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(NODE_TREE_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(PROPERTIES_VIEW_TYPE);
  }
  async createNewUIFile() {
    var _a;
    let filename = "design.uidesign";
    let counter = 1;
    const activeFile = this.app.workspace.getActiveFile();
    const folder = ((_a = activeFile == null ? void 0 : activeFile.parent) == null ? void 0 : _a.path) || "";
    while (this.app.vault.getAbstractFileByPath(
      folder ? `${folder}/${filename}` : filename
    )) {
      filename = `design-${counter}.uidesign`;
      counter++;
    }
    const path = folder ? `${folder}/${filename}` : filename;
    const emptyDoc = {
      version: "1.0",
      name: "Untitled Design",
      tokens: {
        "color.primary": "#2E6BE6",
        "color.secondary": "#6B7280",
        "color.background": "#FFFFFF",
        "color.surface": "#F3F4F6",
        "color.text": "#1F2937",
        "space.sm": 8,
        "space.md": 16,
        "space.lg": 24,
        "radius.sm": 4,
        "radius.md": 8
      },
      components: {},
      screens: {
        main: {
          id: "main",
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
              h: 667
            },
            style: {
              background: "color.background"
            },
            children: []
          }
        }
      }
    };
    const file = await this.app.vault.create(
      path,
      JSON.stringify(emptyDoc, null, 2)
    );
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
  }
  async activateView(viewType, side) {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(viewType)[0] || null;
    if (!leaf) {
      leaf = side === "left" ? workspace.getLeftLeaf(false) : workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: viewType, active: true });
      }
    }
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
  async ensurePanelsOpen() {
    const { workspace } = this.app;
    if (workspace.getLeavesOfType(NODE_TREE_VIEW_TYPE).length === 0) {
      const leftLeaf = workspace.getLeftLeaf(false);
      if (leftLeaf) {
        await leftLeaf.setViewState({ type: NODE_TREE_VIEW_TYPE, active: true });
      }
    }
  }
  /**
   * Get the active UI Editor view if one is open
   */
  getActiveUIEditorView() {
    const activeView = this.app.workspace.getActiveViewOfType(UIEditorView);
    return activeView;
  }
};
