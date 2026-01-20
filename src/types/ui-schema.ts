/**
 * UI Schema Type Definitions
 * Language-agnostic UI description format as per spec
 */

// Design Tokens - named, reusable values
export interface DesignTokens {
  [key: string]: string | number;
}

// Layout modes
export interface AutoLayout {
  mode: "auto";
  direction: "horizontal" | "vertical";
  gap?: string | number;
  padding?: string | number;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "space-between" | "space-around";
  wrap?: boolean;
}

export interface AbsoluteLayout {
  mode: "absolute";
  x: number;
  y: number;
  w: number;
  h: number;
}

// Unity RectTransform-compatible anchored layout
// Anchors are normalized (0..1) relative to parent rect
// Pivot is normalized (0..1) relative to this element's rect
// AnchoredPos is offset from anchor center to pivot in pixels
// SizeDelta is the size adjustment relative to anchor spread in pixels
export interface AnchoredLayout {
  mode: "anchored";
  anchorMin: [number, number]; // [x, y] in range 0..1
  anchorMax: [number, number]; // [x, y] in range 0..1
  pivot: [number, number];     // [x, y] in range 0..1
  anchoredPos: [number, number]; // [x, y] offset in pixels
  sizeDelta: [number, number]; // [width, height] delta in pixels
}

export type NodeLayout = AutoLayout | AbsoluteLayout | AnchoredLayout;

// Style properties - can reference tokens or use direct values
export interface NodeStyle {
  background?: string;
  textColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  opacity?: number;
  fontSize?: string | number;
  fontFamily?: string;
  fontWeight?: string | number;
  shadow?: string;
}

// Content for UI elements
export interface NodeContent {
  text?: string;
  icon?: string;
  placeholder?: string;
  src?: string; // for images
}

// Meta describes intent and behavior, not appearance
export interface NodeMeta {
  purpose?: string;
  behavior?: string;
  states?: string[];
  notes?: string;
  related?: string[];
}

// Common node types
export type NodeType =
  | "Container"
  | "Button"
  | "Text"
  | "Input"
  | "Image"
  | "Icon"
  | "Divider"
  | "Spacer"
  | "Card"
  | "List"
  | "ListItem"
  | "Header"
  | "Footer"
  | "Sidebar"
  | "Modal"
  | "Custom";

// UI Node - the fundamental building block
export interface UINode {
  id: string;
  type: NodeType;
  name?: string; // Human-readable name for the tree view
  layout: NodeLayout;
  style?: NodeStyle;
  content?: NodeContent;
  meta?: NodeMeta;
  children?: UINode[];
}

// Component definition - reusable node template
export interface ComponentDefinition {
  id: string;
  name: string;
  description?: string;
  root: UINode;
  props?: {
    [key: string]: {
      type: "string" | "number" | "boolean" | "token";
      default?: string | number | boolean;
      description?: string;
    };
  };
}

// Screen - a full page/view layout
export interface Screen {
  id: string;
  name: string;
  description?: string;
  root: UINode;
}

// The complete UI Document
export interface UIDocument {
  $schema?: string;
  version?: string;
  name?: string;
  description?: string;
  tokens: DesignTokens;
  components: { [id: string]: ComponentDefinition };
  screens: { [id: string]: Screen };
}

// Helper to create empty document
export function createEmptyDocument(name?: string): UIDocument {
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
      "radius.lg": 12,
    },
    components: {},
    screens: {},
  };
}

// Helper to create a basic node
export function createNode(
  type: NodeType,
  overrides?: Partial<UINode>
): UINode {
  const id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const baseNode: UINode = {
    id,
    type,
    name: type,
    layout: {
      mode: "absolute",
      x: 100,
      y: 100,
      w: type === "Button" ? 120 : type === "Text" ? 200 : 200,
      h: type === "Button" ? 40 : type === "Text" ? 24 : 100,
    },
    style: {
      background: type === "Button" ? "color.primary" : "color.surface",
      textColor: type === "Button" ? "#FFFFFF" : "color.text",
      borderRadius: 4,
    },
    content: {
      text: type === "Button" ? "Button" : type === "Text" ? "Text" : undefined,
    },
    meta: {},
  };

  return { ...baseNode, ...overrides };
}

// Helper to resolve a token value
export function resolveToken(
  value: string | number | undefined,
  tokens: DesignTokens
): string | number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number") return value;
  if (value.startsWith("#") || value.startsWith("rgb")) return value;

  // Check if it's a token reference
  if (tokens[value] !== undefined) {
    return tokens[value];
  }

  return value;
}

// Convert anchored layout to absolute rect given parent dimensions
export function anchoredToAbsolute(
  anchored: AnchoredLayout,
  parentWidth: number,
  parentHeight: number
): { x: number; y: number; w: number; h: number } {
  const { anchorMin, anchorMax, pivot, anchoredPos, sizeDelta } = anchored;

  // Calculate anchor positions in parent space
  const anchorMinX = anchorMin[0] * parentWidth;
  const anchorMinY = anchorMin[1] * parentHeight;
  const anchorMaxX = anchorMax[0] * parentWidth;
  const anchorMaxY = anchorMax[1] * parentHeight;

  // Anchor spread (distance between min and max anchors)
  const anchorSpreadX = anchorMaxX - anchorMinX;
  const anchorSpreadY = anchorMaxY - anchorMinY;

  // Final size = anchor spread + sizeDelta
  const w = anchorSpreadX + sizeDelta[0];
  const h = anchorSpreadY + sizeDelta[1];

  // Anchor center position
  const anchorCenterX = (anchorMinX + anchorMaxX) / 2;
  const anchorCenterY = (anchorMinY + anchorMaxY) / 2;

  // Pivot offset from element's top-left corner
  const pivotOffsetX = pivot[0] * w;
  const pivotOffsetY = pivot[1] * h;

  // Position: anchor center + anchored position - pivot offset
  const x = anchorCenterX + anchoredPos[0] - pivotOffsetX;
  const y = anchorCenterY + anchoredPos[1] - pivotOffsetY;

  return { x, y, w, h };
}

// Convert absolute rect to anchored layout given parent dimensions
export function absoluteToAnchored(
  x: number,
  y: number,
  w: number,
  h: number,
  parentWidth: number,
  parentHeight: number,
  pivot: [number, number] = [0.5, 0.5],
  stretchX: boolean = false,
  stretchY: boolean = false
): AnchoredLayout {
  // Default: anchor to center (0.5, 0.5) with no stretch
  let anchorMin: [number, number];
  let anchorMax: [number, number];
  let anchoredPos: [number, number];
  let sizeDelta: [number, number];

  if (stretchX && stretchY) {
    // Full stretch: anchors at corners, sizeDelta defines padding
    anchorMin = [0, 0];
    anchorMax = [1, 1];
    // sizeDelta is negative (element is smaller than anchor spread by margins)
    const leftMargin = x;
    const rightMargin = parentWidth - (x + w);
    const topMargin = y;
    const bottomMargin = parentHeight - (y + h);
    sizeDelta = [-(leftMargin + rightMargin), -(topMargin + bottomMargin)];
    anchoredPos = [(leftMargin - rightMargin) / 2, (topMargin - bottomMargin) / 2];
  } else if (stretchX) {
    // Horizontal stretch only
    anchorMin = [0, (y + h * pivot[1]) / parentHeight];
    anchorMax = [1, (y + h * pivot[1]) / parentHeight];
    const leftMargin = x;
    const rightMargin = parentWidth - (x + w);
    sizeDelta = [-(leftMargin + rightMargin), h];
    anchoredPos = [(leftMargin - rightMargin) / 2, 0];
  } else if (stretchY) {
    // Vertical stretch only
    anchorMin = [(x + w * pivot[0]) / parentWidth, 0];
    anchorMax = [(x + w * pivot[0]) / parentWidth, 1];
    const topMargin = y;
    const bottomMargin = parentHeight - (y + h);
    sizeDelta = [w, -(topMargin + bottomMargin)];
    anchoredPos = [0, (topMargin - bottomMargin) / 2];
  } else {
    // No stretch: point anchor at element's pivot position
    const anchorX = (x + w * pivot[0]) / parentWidth;
    const anchorY = (y + h * pivot[1]) / parentHeight;
    anchorMin = [anchorX, anchorY];
    anchorMax = [anchorX, anchorY];
    anchoredPos = [0, 0];
    sizeDelta = [w, h];
  }

  return {
    mode: "anchored",
    anchorMin,
    anchorMax,
    pivot,
    anchoredPos,
    sizeDelta,
  };
}

// Create a default anchored layout (centered, no stretch)
export function createDefaultAnchoredLayout(
  w: number = 100,
  h: number = 100
): AnchoredLayout {
  return {
    mode: "anchored",
    anchorMin: [0.5, 0.5],
    anchorMax: [0.5, 0.5],
    pivot: [0.5, 0.5],
    anchoredPos: [0, 0],
    sizeDelta: [w, h],
  };
}
