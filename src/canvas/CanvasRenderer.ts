import { UINode, DesignTokens, resolveToken, resolveTokenAsNumber, resolveTokenAsString, AnchoredLayout, anchoredToAbsolute } from "../types/ui-schema";
import { EditorState, ViewportState } from "../state/EditorState";

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  tokens: DesignTokens;
  viewport: ViewportState;
  selectedIds: Set<string>;
  hoveredId: string | null;
  devicePixelRatio: number;
  parentWidth: number;
  parentHeight: number;
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

    // Get root dimensions for anchored layout calculations
    // The root node defines the design canvas size
    let rootWidth = 375; // default
    let rootHeight = 667; // default
    if (screen.root.layout.mode === "absolute") {
      rootWidth = screen.root.layout.w;
      rootHeight = screen.root.layout.h;
    }

    // Create render context
    const renderCtx: RenderContext = {
      ctx: this.ctx,
      tokens: doc.tokens,
      viewport,
      selectedIds: new Set(this.state.getSelectedNodeIds()),
      hoveredId: this.state.getHoveredNodeId(),
      devicePixelRatio: this.dpr,
      parentWidth: rootWidth,
      parentHeight: rootHeight,
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
    // Calculate x, y, w, h based on layout mode
    let x: number, y: number, w: number, h: number;

    if (node.layout.mode === "absolute") {
      x = node.layout.x;
      y = node.layout.y;
      w = node.layout.w;
      h = node.layout.h;
    } else if (node.layout.mode === "anchored") {
      const rect = anchoredToAbsolute(
        node.layout as AnchoredLayout,
        ctx.parentWidth,
        ctx.parentHeight
      );
      x = rect.x;
      y = rect.y;
      w = rect.w;
      h = rect.h;
    } else {
      // Auto layout not supported for rendering yet
      return;
    }

    const isSelected = ctx.selectedIds.has(node.id);
    const isHovered = ctx.hoveredId === node.id;

    // Resolve styles with full token support
    const bgColor = this.resolveColor(node.style?.background, ctx.tokens);
    const textColor = this.resolveColor(node.style?.textColor, ctx.tokens);
    const borderColor = this.resolveColor(node.style?.borderColor, ctx.tokens);
    const borderRadius = resolveTokenAsNumber(node.style?.borderRadius, ctx.tokens, 0) || 0;
    const borderWidth = resolveTokenAsNumber(node.style?.borderWidth, ctx.tokens, 0) || 0;
    const shadow = resolveTokenAsString(node.style?.shadow, ctx.tokens);

    // Resolve typography tokens
    const fontSize = resolveTokenAsNumber(node.style?.fontSize, ctx.tokens, 14) || 14;
    const fontFamily = resolveTokenAsString(node.style?.fontFamily, ctx.tokens, "Inter, sans-serif") || "Inter, sans-serif";
    const fontWeight = resolveTokenAsNumber(node.style?.fontWeight, ctx.tokens, 400) || 400;

    // Draw shadow if specified
    if (shadow && shadow !== "none") {
      ctx.ctx.save();
      ctx.ctx.shadowColor = "rgba(0, 0, 0, 0.1)";
      // Parse shadow string for offset (simplified parsing)
      const shadowMatch = shadow.match(/(-?\d+)px\s+(-?\d+)px\s+(-?\d+)px/);
      if (shadowMatch) {
        ctx.ctx.shadowOffsetX = parseFloat(shadowMatch[1]);
        ctx.ctx.shadowOffsetY = parseFloat(shadowMatch[2]);
        ctx.ctx.shadowBlur = parseFloat(shadowMatch[3]);
      } else {
        ctx.ctx.shadowOffsetX = 0;
        ctx.ctx.shadowOffsetY = 4;
        ctx.ctx.shadowBlur = 6;
      }
    }

    // Draw background
    if (bgColor) {
      ctx.ctx.fillStyle = bgColor;
      this.roundRect(ctx.ctx, x, y, w, h, borderRadius);
      ctx.ctx.fill();
    }

    // Restore after shadow
    if (shadow && shadow !== "none") {
      ctx.ctx.restore();
    }

    // Draw border if specified or for containers/selection
    const shouldDrawBorder = borderWidth > 0 || node.type === "Container" || isSelected || isHovered;
    if (shouldDrawBorder) {
      if (isSelected) {
        ctx.ctx.strokeStyle = "#2E6BE6";
        ctx.ctx.lineWidth = 2 / ctx.viewport.zoom;
      } else if (isHovered) {
        ctx.ctx.strokeStyle = "#5a8dee";
        ctx.ctx.lineWidth = 1 / ctx.viewport.zoom;
      } else if (borderWidth > 0 && borderColor) {
        ctx.ctx.strokeStyle = borderColor;
        ctx.ctx.lineWidth = borderWidth;
      } else {
        ctx.ctx.strokeStyle = "#555";
        ctx.ctx.lineWidth = 1 / ctx.viewport.zoom;
      }
      this.roundRect(ctx.ctx, x, y, w, h, borderRadius);
      ctx.ctx.stroke();
    }

    // Draw text content with full typography support
    if (node.content?.text) {
      ctx.ctx.fillStyle = textColor || "#333";
      ctx.ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
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

    // Draw anchor indicators for anchored layout when selected
    if (isSelected && node.layout.mode === "anchored") {
      this.drawAnchorIndicators(ctx.ctx, node.layout as AnchoredLayout, ctx.parentWidth, ctx.parentHeight, ctx.viewport.zoom);
    }

    // Draw selection handles
    if (isSelected) {
      this.drawSelectionHandles(ctx.ctx, x, y, w, h, ctx.viewport.zoom);
    }

    // Render children
    if (node.children) {
      for (const child of node.children) {
        ctx.ctx.save();
        // Children are positioned relative to parent
        ctx.ctx.translate(x, y);
        // Create child context with this node's dimensions as parent
        const childCtx: RenderContext = {
          ...ctx,
          parentWidth: w,
          parentHeight: h,
        };
        this.renderNode(child, childCtx);
        ctx.ctx.restore();
      }
    }
  }

  private drawAnchorIndicators(
    ctx: CanvasRenderingContext2D,
    layout: AnchoredLayout,
    parentWidth: number,
    parentHeight: number,
    zoom: number
  ): void {
    const { anchorMin, anchorMax } = layout;

    // Draw anchor lines (dashed)
    ctx.strokeStyle = "#ff9900";
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);

    // Anchor min X line
    const minX = anchorMin[0] * parentWidth;
    ctx.beginPath();
    ctx.moveTo(minX, 0);
    ctx.lineTo(minX, parentHeight);
    ctx.stroke();

    // Anchor max X line (if different from min)
    if (anchorMax[0] !== anchorMin[0]) {
      const maxX = anchorMax[0] * parentWidth;
      ctx.beginPath();
      ctx.moveTo(maxX, 0);
      ctx.lineTo(maxX, parentHeight);
      ctx.stroke();
    }

    // Anchor min Y line
    const minY = anchorMin[1] * parentHeight;
    ctx.beginPath();
    ctx.moveTo(0, minY);
    ctx.lineTo(parentWidth, minY);
    ctx.stroke();

    // Anchor max Y line (if different from min)
    if (anchorMax[1] !== anchorMin[1]) {
      const maxY = anchorMax[1] * parentHeight;
      ctx.beginPath();
      ctx.moveTo(0, maxY);
      ctx.lineTo(parentWidth, maxY);
      ctx.stroke();
    }

    ctx.setLineDash([]);
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

    // Get root dimensions
    let rootWidth = 375;
    let rootHeight = 667;
    if (screen.root.layout.mode === "absolute") {
      rootWidth = screen.root.layout.w;
      rootHeight = screen.root.layout.h;
    }

    // Test nodes in reverse order (top-most first)
    return this.hitTestNode(screen.root, worldX, worldY, 0, 0, rootWidth, rootHeight);
  }

  private hitTestNode(
    node: UINode,
    worldX: number,
    worldY: number,
    parentX: number,
    parentY: number,
    parentWidth: number,
    parentHeight: number
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

    // Check children first (they're on top)
    if (node.children) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        const hit = this.hitTestNode(
          node.children[i],
          worldX,
          worldY,
          nodeX,
          nodeY,
          w,
          h
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
    if (!selectedNode) return null;
    if (selectedNode.layout.mode !== "absolute" && selectedNode.layout.mode !== "anchored") return null;

    const viewport = this.state.getViewport();
    const worldX = (screenX - viewport.panX) / viewport.zoom;
    const worldY = (screenY - viewport.panY) / viewport.zoom;

    // Get absolute position (accounting for parent offsets)
    const absolutePos = this.state.getAbsolutePosition(selectedNode.id);
    if (!absolutePos) return null;

    const x = absolutePos.x;
    const y = absolutePos.y;
    const w = absolutePos.w;
    const h = absolutePos.h;
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
