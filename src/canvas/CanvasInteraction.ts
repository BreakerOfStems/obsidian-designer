import { EditorState } from "../state/EditorState";
import { CanvasRenderer } from "./CanvasRenderer";
import { createNode, NodeType } from "../types/ui-schema";
import { ClipboardService } from "../clipboard/ClipboardService";

type DragMode = "none" | "pan" | "move" | "resize";

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

    // Keyboard events
    this.canvas.tabIndex = 0; // Make canvas focusable
    this.canvas.addEventListener("keydown", this.onKeyDown.bind(this));
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

  private onMouseUp(_e: MouseEvent): void {
    this.drag.mode = "none";
    this.drag.resizeHandle = null;
    this.canvas.style.cursor = "default";
  }

  private onMouseLeave(_e: MouseEvent): void {
    this.state.setHoveredNode(null);
    if (this.drag.mode !== "none") {
      this.drag.mode = "none";
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

  private onKeyDown(e: KeyboardEvent): void {
    const selectedIds = this.state.getSelectedNodeIds();

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
        e.preventDefault();
        break;

      case "Escape":
        this.state.clearSelection();
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
          e.preventDefault();
        }
        break;

      case "c":
        if (e.ctrlKey || e.metaKey) {
          // Copy selected nodes
          this.copySelection();
          e.preventDefault();
        }
        break;

      case "x":
        if (e.ctrlKey || e.metaKey) {
          // Cut selected nodes (copy then delete)
          this.cutSelection();
          e.preventDefault();
        }
        break;

      case "v":
        if (e.ctrlKey || e.metaKey) {
          // Paste at cursor position
          this.pasteAtCursor();
          e.preventDefault();
        }
        break;

      case "d":
        if (e.ctrlKey || e.metaKey) {
          // Duplicate selected nodes
          this.duplicateSelection();
          e.preventDefault();
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
          e.preventDefault();
        }
        break;

      case "y":
        if (e.ctrlKey || e.metaKey) {
          // Redo (alternative)
          this.state.redo();
          e.preventDefault();
        }
        break;
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
    const node = this.state.getSelectedNode();
    if (!node || node.layout.mode !== "absolute") return;

    this.drag = {
      mode: "move",
      startX: x,
      startY: y,
      startPanX: 0,
      startPanY: 0,
      startNodeX: node.layout.x,
      startNodeY: node.layout.y,
      startNodeW: node.layout.w,
      startNodeH: node.layout.h,
      resizeHandle: null,
    };
    this.canvas.style.cursor = "move";
  }

  private doMove(x: number, y: number): void {
    const node = this.state.getSelectedNode();
    if (!node || node.layout.mode !== "absolute") return;

    const viewport = this.state.getViewport();
    const dx = (x - this.drag.startX) / viewport.zoom;
    const dy = (y - this.drag.startY) / viewport.zoom;

    this.state.updateNodeLayout(node.id, {
      mode: "absolute",
      x: this.snap(this.drag.startNodeX + dx),
      y: this.snap(this.drag.startNodeY + dy),
      w: node.layout.w,
      h: node.layout.h,
    });
  }

  private startResize(x: number, y: number, handle: string): void {
    const node = this.state.getSelectedNode();
    if (!node || node.layout.mode !== "absolute") return;

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
    };
    this.updateResizeCursor(handle);
  }

  private doResize(x: number, y: number): void {
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

    // Handle horizontal resize
    if (handle.includes("e")) {
      newW = Math.max(20, this.drag.startNodeW + dx);
    }
    if (handle.includes("w")) {
      const maxDx = this.drag.startNodeW - 20;
      const clampedDx = Math.min(dx, maxDx);
      newX = this.drag.startNodeX + clampedDx;
      newW = this.drag.startNodeW - clampedDx;
    }

    // Handle vertical resize
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
      h: this.snap(newH),
    });
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
        mode: "absolute",
        x: Math.round(centerX - 50),
        y: Math.round(centerY - 25),
        w: type === "Button" ? 120 : 200,
        h: type === "Button" ? 40 : 100,
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
    // Event listeners are automatically cleaned up when canvas is removed
  }
}
