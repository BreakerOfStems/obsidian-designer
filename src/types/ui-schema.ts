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

// Responsive constraints for layout intent under resizing
export interface LayoutPin {
  left?: boolean;
  right?: boolean;
  top?: boolean;
  bottom?: boolean;
  centerX?: boolean;
  centerY?: boolean;
}

export interface LayoutConstraints {
  // Edge pinning for responsive positioning
  pin?: LayoutPin;
  // Size constraints in pixels
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  // Aspect ratio lock (e.g., 1.777 for 16:9, null to disable)
  aspectLock?: number | null;
  // Whether to respect device safe areas (notches, etc.)
  safeArea?: boolean;
  // How the element scales when container resizes
  scaleMode?: "fixed" | "fit" | "fill";
}

// Style properties - can reference tokens or use direct values
// String values can be token references (e.g., "color.primary", "space.md", "radius.sm")
export interface NodeStyle {
  background?: string;
  textColor?: string;
  borderColor?: string;
  borderWidth?: string | number; // Can be token ref (e.g., "space.xs") or number
  borderRadius?: string | number; // Can be token ref (e.g., "radius.md") or number
  opacity?: number;
  fontSize?: string | number; // Can be token ref (e.g., "type.size.md") or number
  fontFamily?: string; // Can be token ref (e.g., "type.font.body") or string
  fontWeight?: string | number; // Can be token ref (e.g., "type.weight.bold") or value
  lineHeight?: string | number; // Can be token ref (e.g., "type.lineHeight.normal") or number
  shadow?: string; // Can be token ref (e.g., "elevation.md") or CSS shadow string
  // Padding/margin as token references or numbers
  padding?: string | number;
  paddingTop?: string | number;
  paddingRight?: string | number;
  paddingBottom?: string | number;
  paddingLeft?: string | number;
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
  constraints?: LayoutConstraints; // Optional responsive constraints
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
      // Color tokens
      "color.primary": "#2E6BE6",
      "color.secondary": "#6B7280",
      "color.background": "#FFFFFF",
      "color.surface": "#F3F4F6",
      "color.text": "#1F2937",
      "color.textMuted": "#6B7280",
      "color.error": "#EF4444",
      "color.success": "#10B981",
      "color.warning": "#F59E0B",

      // Spacing tokens (in pixels)
      "space.xs": 4,
      "space.sm": 8,
      "space.md": 16,
      "space.lg": 24,
      "space.xl": 32,
      "space.2xl": 48,
      "space.3xl": 64,

      // Border radius tokens (in pixels)
      "radius.none": 0,
      "radius.sm": 4,
      "radius.md": 8,
      "radius.lg": 12,
      "radius.xl": 16,
      "radius.full": 9999,

      // Typography - Font families
      "type.font.body": "Inter, system-ui, sans-serif",
      "type.font.heading": "Inter, system-ui, sans-serif",
      "type.font.mono": "JetBrains Mono, Consolas, monospace",

      // Typography - Font sizes (in pixels)
      "type.size.xs": 12,
      "type.size.sm": 14,
      "type.size.md": 16,
      "type.size.lg": 18,
      "type.size.xl": 20,
      "type.size.2xl": 24,
      "type.size.3xl": 30,
      "type.size.4xl": 36,

      // Typography - Font weights
      "type.weight.normal": 400,
      "type.weight.medium": 500,
      "type.weight.semibold": 600,
      "type.weight.bold": 700,

      // Typography - Line heights (multipliers)
      "type.lineHeight.tight": 1.25,
      "type.lineHeight.normal": 1.5,
      "type.lineHeight.relaxed": 1.75,

      // Elevation/shadow tokens (CSS box-shadow values)
      "elevation.none": "none",
      "elevation.sm": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      "elevation.md": "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
      "elevation.lg": "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
      "elevation.xl": "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
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
      borderRadius: "radius.sm",
      fontSize: type === "Text" ? "type.size.md" : "type.size.sm",
      fontFamily: "type.font.body",
      fontWeight: type === "Button" ? "type.weight.medium" : "type.weight.normal",
      padding: type === "Button" ? "space.sm" : undefined,
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

// Helper to resolve a token and ensure it's a number
export function resolveTokenAsNumber(
  value: string | number | undefined,
  tokens: DesignTokens,
  defaultValue?: number
): number | undefined {
  const resolved = resolveToken(value, tokens);
  if (resolved === undefined) return defaultValue;
  if (typeof resolved === "number") return resolved;
  const parsed = parseFloat(resolved);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Helper to resolve a token and ensure it's a string
export function resolveTokenAsString(
  value: string | number | undefined,
  tokens: DesignTokens,
  defaultValue?: string
): string | undefined {
  const resolved = resolveToken(value, tokens);
  if (resolved === undefined) return defaultValue;
  return String(resolved);
}

// Get token category from a token key (e.g., "color.primary" -> "color")
export function getTokenCategory(tokenKey: string): string {
  const dotIndex = tokenKey.indexOf(".");
  return dotIndex > 0 ? tokenKey.substring(0, dotIndex) : tokenKey;
}

// Get all tokens of a specific category
export function getTokensByCategory(
  tokens: DesignTokens,
  category: string
): { [key: string]: string | number } {
  const result: { [key: string]: string | number } = {};
  for (const key of Object.keys(tokens)) {
    if (key.startsWith(category + ".")) {
      result[key] = tokens[key];
    }
  }
  return result;
}

// Get all token categories
export function getTokenCategories(tokens: DesignTokens): string[] {
  const categories = new Set<string>();
  for (const key of Object.keys(tokens)) {
    categories.add(getTokenCategory(key));
  }
  return Array.from(categories).sort();
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
