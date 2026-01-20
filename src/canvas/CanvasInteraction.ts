import { Menu } from "obsidian";
import { EditorState } from "../state/EditorState";
import { CanvasRenderer } from "./CanvasRenderer";
import { createNode, NodeType, AnchoredLayout } from "../types/ui-schema";
import { ClipboardService } from "../clipboard/ClipboardService";

type DragMode = "none" | "pan" | "move" | "resize";

interface NodeStartPosition {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  layoutMode: "absolute" | "anchored";
  // For anchored layout
  anchoredPos?: [number, number];
  sizeDelta?: [number, number];
}

interface DragState {
  mode: DragMode;
  startX: number;
  startY: number;
  startPanX: number;
  startPanY: number;
  startNodeX: number;
  startNodeY: number;
  startNodeW: number;
  startNodeH: number;
  resizeHandle: string | null;
  // For multi-select movement
  selectedNodesStart: NodeStartPosition[];
}

/**
 * Handles mouse/keyboard interactions on the canvas
 */
export class CanvasInteraction {
  private canvas: HTMLCanvasElement;
  private state: EditorState;
  private renderer: CanvasRenderer;
  private drag: DragState;
  private snapEnabled: boolean = true;
  private snapSize: number = 10;
  private clipboardService: ClipboardService;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private boundKeyDownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    state: EditorState,
    renderer: CanvasRenderer
  ) {
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
      selectedNodesStart: [],
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener("mousedown", this.onMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.onMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.onMouseUp.bind(this));
    this.canvas.addEventListener("mouseleave", this.onMouseLeave.bind(this));
    this.canvas.addEventListener("wheel", this.onWheel.bind(this), {
      passive: false,
    });
    this.canvas.addEventListener("dblclick", this.onDoubleClick.bind(this));
    this.canvas.addEventListener("contextmenu", this.onContextMenu.bind(this));

    // Keyboard events - use capture phase to intercept before Obsidian
    this.canvas.tabIndex = 0; // Make canvas focusable
    this.canvas.style.outline = "none"; // Remove focus outline
    const keyHandler = this.onKeyDown.bind(this);
    this.boundKeyDownHandler = keyHandler;
    // Listen on the document in capture phase to catch events before Obsidian
    document.addEventListener("keydown", keyHandler, true);
  }

  private getCanvasCoords(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private onMouseDown(e: MouseEvent): void {
    const coords = this.getCanvasCoords(e);
    this.canvas.focus();

    // Middle mouse button or space+click for panning
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      this.startPan(coords.x, coords.y);
      e.preventDefault();
      return;
    }

    // Left click
    if (e.button === 0) {
      // Check for resize handle
      const handle = this.renderer.getHandleAtPosition(coords.x, coords.y);
      if (handle) {
        this.startResize(coords.x, coords.y, handle);
        return;
      }

      // Check for node hit
      const hitNodeId = this.renderer.hitTest(coords.x, coords.y);

      if (hitNodeId) {
        if (e.shiftKey) {
          // Multi-select toggle
          if (this.state.isNodeSelected(hitNodeId)) {
            this.state.deselectNode(hitNodeId);
          } else {
            this.state.selectNode(hitNodeId, true);
          }
        } else if (!this.state.isNodeSelected(hitNodeId)) {
          // Single select
          this.state.selectNode(hitNodeId);
        }

        // Start drag if we have a selection
        if (this.state.isNodeSelected(hitNodeId)) {
          this.startMove(coords.x, coords.y);
        }
      } else {
        // Clicked on empty space
        this.state.clearSelection();
      }
    }
  }

  private onMouseMove(e: MouseEvent): void {
    const coords = this.getCanvasCoords(e);

    // Track last mouse position for paste operations
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

  private onMouseUp(e: MouseEvent): void {
    // Handle reparenting after move
    if (this.drag.mode === "move") {
      this.handleDropReparent(e);
      // End the move batch
      this.state.endBatch();
    } else if (this.drag.mode === "resize") {
      // End the resize batch
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
  private handleDropReparent(_e: MouseEvent): void {
    const selectedIds = this.state.getSelectedNodeIds();
    if (selectedIds.length === 0) return;

    // For each selected node, find what container it should belong to
    for (const nodeId of selectedIds) {
      const node = this.state.findNodeById(nodeId);
      if (!node) continue;
      if (node.layout.mode !== "absolute" && node.layout.mode !== "anchored") continue;

      // Get the center of the node in world coordinates
      const absolutePos = this.state.getAbsolutePosition(nodeId);
      if (!absolutePos) continue;

      const nodeCenterX = absolutePos.x + absolutePos.w / 2;
      const nodeCenterY = absolutePos.y + absolutePos.h / 2;

      // Find the deepest container at the node's center, excluding selected nodes
      const targetContainerId = this.state.findContainerAtPosition(
        nodeCenterX,
        nodeCenterY,
        selectedIds
      );

      if (targetContainerId) {
        // Reparent to the target container
        this.state.reparentNode(nodeId, targetContainerId);
      }
    }
  }

  private onMouseLeave(_e: MouseEvent): void {
    this.state.setHoveredNode(null);
    if (this.drag.mode !== "none") {
      // End any active batch if we were in move or resize mode
      if (this.drag.mode === "move" || this.drag.mode === "resize") {
        this.state.endBatch();
      }
      this.drag.mode = "none";
      this.drag.selectedNodesStart = [];
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();

    const coords = this.getCanvasCoords(e);
    const viewport = this.state.getViewport();

    if (e.ctrlKey) {
      // Zoom
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(viewport.zoom * zoomFactor, 0.1), 5);

      // Zoom toward mouse position
      const worldX = (coords.x - viewport.panX) / viewport.zoom;
      const worldY = (coords.y - viewport.panY) / viewport.zoom;

      const newPanX = coords.x - worldX * newZoom;
      const newPanY = coords.y - worldY * newZoom;

      this.state.setViewport({
        zoom: newZoom,
        panX: newPanX,
        panY: newPanY,
      });
    } else {
      // Pan
      this.state.setViewport({
        panX: viewport.panX - e.deltaX,
        panY: viewport.panY - e.deltaY,
      });
    }
  }

  private onDoubleClick(e: MouseEvent): void {
    const coords = this.getCanvasCoords(e);
    const hitNodeId = this.renderer.hitTest(coords.x, coords.y);

    if (!hitNodeId) {
      // Double click on empty space - could add a new node here
      // For now, just reset viewport
      this.state.setViewport({ panX: 50, panY: 50, zoom: 1 });
    }
  }

  private onContextMenu(e: MouseEvent): void {
    e.preventDefault();
    const coords = this.getCanvasCoords(e);

    // Update mouse position for paste operations
    this.lastMouseX = coords.x;
    this.lastMouseY = coords.y;

    // Check if right-clicked on a node
    const hitNodeId = this.renderer.hitTest(coords.x, coords.y);

    // If clicked on a node that isn't selected, select it
    if (hitNodeId && !this.state.isNodeSelected(hitNodeId)) {
      this.state.selectNode(hitNodeId);
    }

    const selectedIds = this.state.getSelectedNodeIds();
    const hasSelection = selectedIds.length > 0;
    const hasClipboard = this.hasClipboardContent();

    // Create Obsidian menu
    const menu = new Menu();

    // Copy option
    menu.addItem((item) => {
      item
        .setTitle("Copy")
        .setIcon("copy")
        .setDisabled(!hasSelection)
        .onClick(() => {
          this.copySelection();
        });
    });

    // Cut option
    menu.addItem((item) => {
      item
        .setTitle("Cut")
        .setIcon("scissors")
        .setDisabled(!hasSelection)
        .onClick(() => {
          this.cutSelection();
        });
    });

    // Paste option
    menu.addItem((item) => {
      item
        .setTitle("Paste")
        .setIcon("clipboard-paste")
        .setDisabled(!hasClipboard)
        .onClick(() => {
          this.pasteAtCursor();
        });
    });

    // Separator
    menu.addSeparator();

    // Duplicate option
    menu.addItem((item) => {
      item
        .setTitle("Duplicate")
        .setIcon("copy-plus")
        .setDisabled(!hasSelection)
        .onClick(() => {
          this.duplicateSelection();
        });
    });

    // Delete option
    menu.addItem((item) => {
      item
        .setTitle("Delete")
        .setIcon("trash-2")
        .setDisabled(!hasSelection)
        .onClick(() => {
          for (const id of selectedIds) {
            const node = this.state.findNodeById(id);
            if (node && node.id !== "root") {
              this.state.removeNode(id);
            }
          }
        });
    });

    // Show menu at mouse position
    menu.showAtMouseEvent(e);
  }

  private onKeyDown(e: KeyboardEvent): void {
    // Only handle events when canvas is focused
    if (document.activeElement !== this.canvas) {
      return;
    }

    const selectedIds = this.state.getSelectedNodeIds();
    let handled = false;

    switch (e.key) {
      case "Delete":
      case "Backspace":
        // Delete selected nodes
        for (const id of selectedIds) {
          // Don't delete the root node
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
          // Select all nodes (except root)
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
          // Copy selected nodes
          this.copySelection();
          handled = true;
        }
        break;

      case "x":
        if (e.ctrlKey || e.metaKey) {
          // Cut selected nodes (copy then delete)
          this.cutSelection();
          handled = true;
        }
        break;

      case "v":
        if (e.ctrlKey || e.metaKey) {
          // Paste at cursor position
          this.pasteAtCursor();
          handled = true;
        }
        break;

      case "d":
        if (e.ctrlKey || e.metaKey) {
          // Duplicate selected nodes
          this.duplicateSelection();
          handled = true;
        }
        break;

      case "z":
        if (e.ctrlKey || e.metaKey) {
          if (e.shiftKey) {
            // Redo
            this.state.redo();
          } else {
            // Undo
            this.state.undo();
          }
          handled = true;
        }
        break;

      case "y":
        if (e.ctrlKey || e.metaKey) {
          // Redo (alternative)
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
  private startPan(x: number, y: number): void {
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
      selectedNodesStart: [],
    };
    this.canvas.style.cursor = "grabbing";
  }

  private doPan(x: number, y: number): void {
    const dx = x - this.drag.startX;
    const dy = y - this.drag.startY;
    this.state.setViewport({
      panX: this.drag.startPanX + dx,
      panY: this.drag.startPanY + dy,
    });
  }

  private startMove(x: number, y: number): void {
    const selectedIds = this.state.getSelectedNodeIds();
    if (selectedIds.length === 0) return;

    // Capture initial positions for all selected nodes
    const selectedNodesStart: NodeStartPosition[] = [];
    for (const id of selectedIds) {
      const node = this.state.findNodeById(id);
      if (!node) continue;

      if (node.layout.mode === "absolute") {
        selectedNodesStart.push({
          id: node.id,
          x: node.layout.x,
          y: node.layout.y,
          w: node.layout.w,
          h: node.layout.h,
          layoutMode: "absolute",
        });
      } else if (node.layout.mode === "anchored") {
        const anchoredLayout = node.layout as AnchoredLayout;
        // Get absolute position for reference
        const absPos = this.state.getAbsolutePosition(node.id);
        selectedNodesStart.push({
          id: node.id,
          x: absPos?.x || 0,
          y: absPos?.y || 0,
          w: absPos?.w || 0,
          h: absPos?.h || 0,
          layoutMode: "anchored",
          anchoredPos: [...anchoredLayout.anchoredPos],
          sizeDelta: [...anchoredLayout.sizeDelta],
        });
      }
    }

    if (selectedNodesStart.length === 0) return;

    // Start a batch so the entire move operation is one undo step
    this.state.startBatch("Move");

    // Use first selected node for backwards compatibility
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
      selectedNodesStart,
    };
    this.canvas.style.cursor = "move";
  }

  private doMove(x: number, y: number): void {
    if (this.drag.selectedNodesStart.length === 0) return;

    const viewport = this.state.getViewport();
    const dx = (x - this.drag.startX) / viewport.zoom;
    const dy = (y - this.drag.startY) / viewport.zoom;

    // Move all selected nodes by the same delta
    for (const startPos of this.drag.selectedNodesStart) {
      const node = this.state.findNodeById(startPos.id);
      if (!node) continue;

      if (startPos.layoutMode === "absolute" && node.layout.mode === "absolute") {
        this.state.updateNodeLayout(startPos.id, {
          mode: "absolute",
          x: this.snap(startPos.x + dx),
          y: this.snap(startPos.y + dy),
          w: startPos.w,
          h: startPos.h,
        });
      } else if (startPos.layoutMode === "anchored" && node.layout.mode === "anchored" && startPos.anchoredPos) {
        // For anchored layout, update the anchoredPos
        const anchoredLayout = node.layout as AnchoredLayout;
        this.state.updateNodeLayout(startPos.id, {
          ...anchoredLayout,
          anchoredPos: [
            this.snap(startPos.anchoredPos[0] + dx),
            this.snap(startPos.anchoredPos[1] + dy),
          ],
        });
      }
    }
  }

  private startResize(x: number, y: number, handle: string): void {
    const node = this.state.getSelectedNode();
    if (!node) return;
    if (node.layout.mode !== "absolute" && node.layout.mode !== "anchored") return;

    // Start a batch so the entire resize operation is one undo step
    this.state.startBatch("Resize");

    // Get absolute position for both layout types
    const absPos = this.state.getAbsolutePosition(node.id);

    // Build selectedNodesStart to track layout mode and anchored values
    const startPos: NodeStartPosition = {
      id: node.id,
      x: absPos?.x || 0,
      y: absPos?.y || 0,
      w: absPos?.w || 100,
      h: absPos?.h || 100,
      layoutMode: node.layout.mode as "absolute" | "anchored",
    };

    if (node.layout.mode === "anchored") {
      const anchoredLayout = node.layout as AnchoredLayout;
      startPos.anchoredPos = [...anchoredLayout.anchoredPos];
      startPos.sizeDelta = [...anchoredLayout.sizeDelta];
    }

    this.drag = {
      mode: "resize",
      startX: x,
      startY: y,
      startPanX: 0,
      startPanY: 0,
      startNodeX: startPos.x,
      startNodeY: startPos.y,
      startNodeW: startPos.w,
      startNodeH: startPos.h,
      resizeHandle: handle,
      selectedNodesStart: [startPos],
    };
    this.updateResizeCursor(handle);
  }

  private doResize(x: number, y: number): void {
    const node = this.state.getSelectedNode();
    if (!node || !this.drag.resizeHandle) return;
    if (node.layout.mode !== "absolute" && node.layout.mode !== "anchored") return;

    const startPos = this.drag.selectedNodesStart[0];
    if (!startPos) return;

    const viewport = this.state.getViewport();
    const dx = (x - this.drag.startX) / viewport.zoom;
    const dy = (y - this.drag.startY) / viewport.zoom;

    let newW = this.drag.startNodeW;
    let newH = this.drag.startNodeH;
    let offsetX = 0; // Movement needed for position adjustment
    let offsetY = 0;

    const handle = this.drag.resizeHandle;

    // Handle horizontal resize
    if (handle.includes("e")) {
      newW = Math.max(20, this.drag.startNodeW + dx);
    }
    if (handle.includes("w")) {
      const maxDx = this.drag.startNodeW - 20;
      const clampedDx = Math.min(dx, maxDx);
      offsetX = clampedDx;
      newW = this.drag.startNodeW - clampedDx;
    }

    // Handle vertical resize
    if (handle.includes("s")) {
      newH = Math.max(20, this.drag.startNodeH + dy);
    }
    if (handle.includes("n")) {
      const maxDy = this.drag.startNodeH - 20;
      const clampedDy = Math.min(dy, maxDy);
      offsetY = clampedDy;
      newH = this.drag.startNodeH - clampedDy;
    }

    if (startPos.layoutMode === "absolute" && node.layout.mode === "absolute") {
      this.state.updateNodeLayout(node.id, {
        mode: "absolute",
        x: this.snap(this.drag.startNodeX + offsetX),
        y: this.snap(this.drag.startNodeY + offsetY),
        w: this.snap(newW),
        h: this.snap(newH),
      });
    } else if (startPos.layoutMode === "anchored" && node.layout.mode === "anchored" && startPos.sizeDelta && startPos.anchoredPos) {
      // For anchored layout, update sizeDelta and possibly anchoredPos
      const anchoredLayout = node.layout as AnchoredLayout;
      const deltaW = newW - this.drag.startNodeW;
      const deltaH = newH - this.drag.startNodeH;

      this.state.updateNodeLayout(node.id, {
        ...anchoredLayout,
        anchoredPos: [
          this.snap(startPos.anchoredPos[0] + offsetX),
          this.snap(startPos.anchoredPos[1] + offsetY),
        ],
        sizeDelta: [
          this.snap(startPos.sizeDelta[0] + deltaW),
          this.snap(startPos.sizeDelta[1] + deltaH),
        ],
      });
    }
  }

  private updateHover(x: number, y: number): void {
    const hitNodeId = this.renderer.hitTest(x, y);
    this.state.setHoveredNode(hitNodeId);
  }

  private updateCursor(x: number, y: number): void {
    const handle = this.renderer.getHandleAtPosition(x, y);
    if (handle) {
      this.updateResizeCursor(handle);
    } else {
      const hitNodeId = this.renderer.hitTest(x, y);
      this.canvas.style.cursor = hitNodeId ? "pointer" : "default";
    }
  }

  private updateResizeCursor(handle: string): void {
    const cursorMap: { [key: string]: string } = {
      nw: "nwse-resize",
      se: "nwse-resize",
      ne: "nesw-resize",
      sw: "nesw-resize",
      n: "ns-resize",
      s: "ns-resize",
      e: "ew-resize",
      w: "ew-resize",
    };
    this.canvas.style.cursor = cursorMap[handle] || "default";
  }

  // Snap value to grid
  private snap(value: number): number {
    if (!this.snapEnabled) return Math.round(value);
    return Math.round(value / this.snapSize) * this.snapSize;
  }

  // Toggle snap on/off
  setSnapEnabled(enabled: boolean): void {
    this.snapEnabled = enabled;
  }

  // Set snap grid size
  setSnapSize(size: number): void {
    this.snapSize = Math.max(1, size);
  }

  isSnapEnabled(): boolean {
    return this.snapEnabled;
  }

  // Public method to add a new node
  addNode(type: NodeType): void {
    const viewport = this.state.getViewport();
    const canvasRect = this.canvas.getBoundingClientRect();

    // Calculate center of visible canvas in world coordinates
    const centerX =
      (canvasRect.width / 2 - viewport.panX) / viewport.zoom;
    const centerY =
      (canvasRect.height / 2 - viewport.panY) / viewport.zoom;

    const node = createNode(type, {
      layout: {
        mode: "anchored",
        anchorMin: [0.5, 0.5],
        anchorMax: [0.5, 0.5],
        pivot: [0.5, 0.5],
        anchoredPos: [0, 0],
        sizeDelta: [type === "Button" ? 120 : 200, type === "Button" ? 40 : 100],
      },
    });

    this.state.addNode(node);
    this.state.selectNode(node.id);
  }

  // Clipboard operations

  /**
   * Copy selected nodes to clipboard
   * Returns true if any nodes were copied
   */
  copySelection(): boolean {
    return this.clipboardService.copy();
  }

  /**
   * Cut selected nodes (copy then delete)
   * Returns true if any nodes were cut
   */
  cutSelection(): boolean {
    const selectedIds = this.state.getSelectedNodeIds();
    if (selectedIds.length === 0) {
      return false;
    }

    // Copy first
    if (!this.clipboardService.copy()) {
      return false;
    }

    // Then delete the selected nodes
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
  pasteAtCursor(): string[] | null {
    // Convert screen coordinates to world coordinates
    const viewport = this.state.getViewport();
    const worldX = (this.lastMouseX - viewport.panX) / viewport.zoom;
    const worldY = (this.lastMouseY - viewport.panY) / viewport.zoom;

    return this.clipboardService.paste(worldX, worldY);
  }

  /**
   * Paste nodes at a specific world position
   * Returns array of pasted node IDs, or null if paste failed
   */
  pasteAtPosition(worldX: number, worldY: number): string[] | null {
    return this.clipboardService.paste(worldX, worldY);
  }

  /**
   * Duplicate selected nodes with a fixed offset
   * Returns array of duplicated node IDs, or null if duplication failed
   */
  duplicateSelection(): string[] | null {
    return this.clipboardService.duplicate();
  }

  /**
   * Check if clipboard has content
   */
  hasClipboardContent(): boolean {
    return this.clipboardService.hasContent();
  }

  /**
   * Get the clipboard service for external access
   */
  getClipboardService(): ClipboardService {
    return this.clipboardService;
  }

  destroy(): void {
    // Remove document-level event listener
    if (this.boundKeyDownHandler) {
      document.removeEventListener("keydown", this.boundKeyDownHandler, true);
      this.boundKeyDownHandler = null;
    }
  }
}
