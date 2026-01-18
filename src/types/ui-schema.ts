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

export type NodeLayout = AutoLayout | AbsoluteLayout;

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
