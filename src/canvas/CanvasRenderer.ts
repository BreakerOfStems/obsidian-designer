import { UINode, DesignTokens, resolveToken } from "../types/ui-schema";
import { EditorState, ViewportState } from "../state/EditorState";

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  tokens: DesignTokens;
  viewport: ViewportState;
  selectedIds: Set<string>;
  hoveredId: string | null;
  devicePixelRatio: number;
}

/**
 * Main canvas renderer - handles viewport transforms and delegates node rendering
 */
export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: EditorState;
  private animationFrameId: number | null = null;
  private dpr: number = 1;

  constructor(canvas: HTMLCanvasElement, state: EditorState) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D context");
    this.ctx = ctx;
    this.state = state;

    this.dpr = window.devicePixelRatio || 1;
    this.setupCanvas();

    // Listen for state changes
    this.state.on("node-updated", () => this.requestRender());
    this.state.on("node-added", () => this.requestRender());
    this.state.on("node-removed", () => this.requestRender());
    this.state.on("selection-changed", () => this.requestRender());
    this.state.on("hover-changed", () => this.requestRender());
    this.state.on("viewport-changed", () => this.requestRender());
    this.state.on("document-loaded", () => this.requestRender());
    this.state.on("screen-changed", () => this.requestRender());
  }

  private setupCanvas(): void {
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;

    const width = rect.width;
    const height = rect.height;

    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.ctx.scale(this.dpr, this.dpr);
    this.requestRender();
  }

  requestRender(): void {
    if (this.animationFrameId !== null) return;
    this.animationFrameId = requestAnimationFrame(() => {
      this.render();
      this.animationFrameId = null;
    });
  }

  render(): void {
    const doc = this.state.getDocument();
    const screen = this.state.getCurrentScreen();

    // Clear canvas
    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;
    this.ctx.clearRect(0, 0, width, height);

    // Draw background
    this.ctx.fillStyle = "#1a1a2e";
    this.ctx.fillRect(0, 0, width, height);

    if (!doc || !screen) {
      this.drawEmptyState(width, height);
      return;
    }

    // Apply viewport transform
    const viewport = this.state.getViewport();
    this.ctx.save();
    this.ctx.translate(viewport.panX, viewport.panY);
    this.ctx.scale(viewport.zoom, viewport.zoom);

    // Draw grid
    this.drawGrid(width, height, viewport);

    // Create render context
    const renderCtx: RenderContext = {
      ctx: this.ctx,
      tokens: doc.tokens,
      viewport,
      selectedIds: new Set(this.state.getSelectedNodeIds()),
      hoveredId: this.state.getHoveredNodeId(),
      devicePixelRatio: this.dpr,
    };

    // Render screen root and children
    this.renderNode(screen.root, renderCtx);

    this.ctx.restore();
  }

  private drawEmptyState(width: number, height: number): void {
    this.ctx.fillStyle = "#666";
    this.ctx.font = "16px Inter, sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.fillText("No document loaded", width / 2, height / 2);
  }

  private drawGrid(
    width: number,
    height: number,
    viewport: ViewportState
  ): void {
    const gridSize = 20;
    const majorGridSize = 100;

    // Calculate visible area in world coordinates
    const startX = -viewport.panX / viewport.zoom;
    const startY = -viewport.panY / viewport.zoom;
    const endX = startX + width / viewport.zoom;
    const endY = startY + height / viewport.zoom;

    // Minor grid
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

    // Major grid
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

    // Origin marker
    this.ctx.strokeStyle = "#666";
    this.ctx.lineWidth = 2 / viewport.zoom;
    this.ctx.beginPath();
    this.ctx.moveTo(-10, 0);
    this.ctx.lineTo(10, 0);
    this.ctx.moveTo(0, -10);
    this.ctx.lineTo(0, 10);
    this.ctx.stroke();
  }

  private renderNode(node: UINode, ctx: RenderContext): void {
    if (node.layout.mode !== "absolute") return;

    const { x, y, w, h } = node.layout;
    const isSelected = ctx.selectedIds.has(node.id);
    const isHovered = ctx.hoveredId === node.id;

    // Resolve styles
    const bgColor = this.resolveColor(node.style?.background, ctx.tokens);
    const textColor = this.resolveColor(node.style?.textColor, ctx.tokens);
    const borderRadius = (node.style?.borderRadius as number) || 0;

    // Draw background
    if (bgColor) {
      ctx.ctx.fillStyle = bgColor;
      this.roundRect(ctx.ctx, x, y, w, h, borderRadius);
      ctx.ctx.fill();
    }

    // Draw border for containers or when selected/hovered
    if (node.type === "Container" || isSelected || isHovered) {
      ctx.ctx.strokeStyle = isSelected
        ? "#2E6BE6"
        : isHovered
        ? "#5a8dee"
        : "#555";
      ctx.ctx.lineWidth = isSelected ? 2 / ctx.viewport.zoom : 1 / ctx.viewport.zoom;
      this.roundRect(ctx.ctx, x, y, w, h, borderRadius);
      ctx.ctx.stroke();
    }

    // Draw text content
    if (node.content?.text) {
      ctx.ctx.fillStyle = textColor || "#333";
      ctx.ctx.font = `14px Inter, sans-serif`;
      ctx.ctx.textAlign = "center";
      ctx.ctx.textBaseline = "middle";
      ctx.ctx.fillText(node.content.text, x + w / 2, y + h / 2);
    }

    // Draw type label for containers
    if (node.type === "Container" && !node.content?.text) {
      ctx.ctx.fillStyle = "#888";
      ctx.ctx.font = `10px Inter, sans-serif`;
      ctx.ctx.textAlign = "left";
      ctx.ctx.textBaseline = "top";
      ctx.ctx.fillText(node.name || node.type, x + 4, y + 4);
    }

    // Draw selection handles
    if (isSelected) {
      this.drawSelectionHandles(ctx.ctx, x, y, w, h, ctx.viewport.zoom);
    }

    // Render children
    if (node.children) {
      for (const child of node.children) {
        ctx.ctx.save();
        // Children are positioned relative to parent for absolute layout
        ctx.ctx.translate(x, y);
        // Adjust child coordinates temporarily
        const childLayout = { ...child.layout };
        this.renderNode(child, ctx);
        ctx.ctx.restore();
      }
    }
  }

  private resolveColor(
    value: string | undefined,
    tokens: DesignTokens
  ): string | null {
    if (!value) return null;
    const resolved = resolveToken(value, tokens);
    return typeof resolved === "string" ? resolved : null;
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
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

  private drawSelectionHandles(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    zoom: number
  ): void {
    const handleSize = 8 / zoom;
    const handles = [
      { x: x - handleSize / 2, y: y - handleSize / 2 }, // top-left
      { x: x + w / 2 - handleSize / 2, y: y - handleSize / 2 }, // top-center
      { x: x + w - handleSize / 2, y: y - handleSize / 2 }, // top-right
      { x: x + w - handleSize / 2, y: y + h / 2 - handleSize / 2 }, // right-center
      { x: x + w - handleSize / 2, y: y + h - handleSize / 2 }, // bottom-right
      { x: x + w / 2 - handleSize / 2, y: y + h - handleSize / 2 }, // bottom-center
      { x: x - handleSize / 2, y: y + h - handleSize / 2 }, // bottom-left
      { x: x - handleSize / 2, y: y + h / 2 - handleSize / 2 }, // left-center
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
  hitTest(screenX: number, screenY: number): string | null {
    const screen = this.state.getCurrentScreen();
    if (!screen) return null;

    const viewport = this.state.getViewport();

    // Convert screen to world coordinates
    const worldX = (screenX - viewport.panX) / viewport.zoom;
    const worldY = (screenY - viewport.panY) / viewport.zoom;

    // Test nodes in reverse order (top-most first)
    return this.hitTestNode(screen.root, worldX, worldY, 0, 0);
  }

  private hitTestNode(
    node: UINode,
    worldX: number,
    worldY: number,
    parentX: number,
    parentY: number
  ): string | null {
    if (node.layout.mode !== "absolute") return null;

    const { x, y, w, h } = node.layout;
    const nodeX = parentX + x;
    const nodeY = parentY + y;

    // Check children first (they're on top)
    if (node.children) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        const hit = this.hitTestNode(
          node.children[i],
          worldX,
          worldY,
          nodeX,
          nodeY
        );
        if (hit) return hit;
      }
    }

    // Check this node
    if (
      worldX >= nodeX &&
      worldX <= nodeX + w &&
      worldY >= nodeY &&
      worldY <= nodeY + h
    ) {
      return node.id;
    }

    return null;
  }

  // Get handle at position (for resize)
  getHandleAtPosition(
    screenX: number,
    screenY: number
  ): string | null {
    const selectedNode = this.state.getSelectedNode();
    if (!selectedNode || selectedNode.layout.mode !== "absolute") return null;

    const viewport = this.state.getViewport();
    const worldX = (screenX - viewport.panX) / viewport.zoom;
    const worldY = (screenY - viewport.panY) / viewport.zoom;

    const { x, y, w, h } = selectedNode.layout;
    const handleSize = 8 / viewport.zoom;
    const tolerance = handleSize;

    const handles: { [key: string]: { x: number; y: number } } = {
      "nw": { x: x, y: y },
      "n": { x: x + w / 2, y: y },
      "ne": { x: x + w, y: y },
      "e": { x: x + w, y: y + h / 2 },
      "se": { x: x + w, y: y + h },
      "s": { x: x + w / 2, y: y + h },
      "sw": { x: x, y: y + h },
      "w": { x: x, y: y + h / 2 },
    };

    for (const [name, pos] of Object.entries(handles)) {
      if (
        Math.abs(worldX - pos.x) <= tolerance &&
        Math.abs(worldY - pos.y) <= tolerance
      ) {
        return name;
      }
    }

    return null;
  }

  destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener("resize", () => this.resize());
  }
}
