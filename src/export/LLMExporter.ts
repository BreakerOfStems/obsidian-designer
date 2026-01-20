/**
 * LLM Export Profile - Intent-First Output
 *
 * Exports UI designs in an LLM-friendly JSON format with:
 * - Normalized values (tokens resolved)
 * - Explicit roles and semantic metadata
 * - Constraints emphasized
 * - Screen contracts included
 * - Layout as anchored (preferred) with optional derived absolute rects
 * - Deterministic output ordering
 */

import {
  UIDocument,
  UINode,
  Screen,
  ScreenContract,
  NodeMeta,
  NodeBehavior,
  NodeBinding,
  NodeStyle,
  NodeContent,
  LayoutConstraints,
  NodeLayout,
  AnchoredLayout,
  AbsoluteLayout,
  AutoLayout,
  DesignTokens,
  resolveToken,
  anchoredToAbsolute,
  createDefaultScreenContract,
} from "../types/ui-schema";

/**
 * Options for LLM export
 */
export interface LLMExportOptions {
  /** Include derived absolute rects for readability (default: true) */
  includeAbsoluteRects: boolean;
  /** Redact editor-only fields like autofilled, templateVersion (default: true) */
  redactEditorFields: boolean;
  /** Resolve token references to actual values (default: true) */
  resolveTokens: boolean;
  /** Include empty/undefined fields (default: false) */
  includeEmptyFields: boolean;
}

/**
 * Default export options
 */
export const DEFAULT_LLM_EXPORT_OPTIONS: LLMExportOptions = {
  includeAbsoluteRects: true,
  redactEditorFields: true,
  resolveTokens: true,
  includeEmptyFields: false,
};

/**
 * LLM-friendly node representation
 */
export interface LLMNode {
  id: string;
  type: string;
  name?: string;
  role?: string;
  meta?: LLMMeta;
  layout: LLMLayout;
  constraints?: LayoutConstraints;
  style?: LLMStyle;
  content?: NodeContent;
  behavior?: NodeBehavior;
  bind?: NodeBinding;
  children?: LLMNode[];
}

/**
 * LLM-friendly meta (semantic metadata)
 */
export interface LLMMeta {
  role?: string;
  purpose?: string;
  behavior?: string;
  states?: string[];
  a11y?: {
    label?: string;
    hint?: string;
    role?: string;
    live?: string;
  };
  notes?: string;
  related?: string[];
}

/**
 * LLM-friendly layout with optional absolute rect
 */
export interface LLMLayout {
  mode: "absolute" | "anchored" | "auto";
  // Anchored layout (Unity RectTransform compatible)
  anchorMin?: [number, number];
  anchorMax?: [number, number];
  pivot?: [number, number];
  anchoredPos?: [number, number];
  sizeDelta?: [number, number];
  // Absolute layout
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  // Auto layout
  direction?: "horizontal" | "vertical";
  gap?: number;
  padding?: number;
  align?: string;
  justify?: string;
  wrap?: boolean;
  // Derived absolute rect (for readability)
  absoluteRect?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

/**
 * LLM-friendly style with resolved tokens
 */
export interface LLMStyle {
  background?: string | number;
  textColor?: string | number;
  borderColor?: string | number;
  borderWidth?: number;
  borderRadius?: number;
  opacity?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  lineHeight?: number;
  shadow?: string;
  padding?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
}

/**
 * LLM-friendly screen representation
 */
export interface LLMScreen {
  id: string;
  name: string;
  description?: string;
  contract: ScreenContract;
  root: LLMNode;
}

/**
 * Complete LLM export spec
 */
export interface LLMSpec {
  $format: "llm-ui-spec";
  $version: "1.0";
  name?: string;
  description?: string;
  tokens: DesignTokens;
  screens: { [id: string]: LLMScreen };
}

/**
 * Sort object keys alphabetically for deterministic output
 */
function sortObjectKeys<T extends object>(obj: T): T {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return obj;
  }

  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj).sort();

  for (const key of keys) {
    const value = (obj as Record<string, unknown>)[key];
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      sorted[key] = sortObjectKeys(value as object);
    } else if (Array.isArray(value)) {
      sorted[key] = value.map((item) =>
        typeof item === "object" && item !== null ? sortObjectKeys(item) : item
      );
    } else {
      sorted[key] = value;
    }
  }

  return sorted as T;
}

/**
 * Remove undefined and null values from an object
 */
function removeEmpty<T extends object>(obj: T, includeEmpty: boolean): Partial<T> {
  if (includeEmpty) return obj;

  const result: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "object" && !Array.isArray(value)) {
      const cleaned = removeEmpty(value, includeEmpty);
      if (Object.keys(cleaned).length > 0) {
        (result as Record<string, unknown>)[key] = cleaned;
      }
    } else if (Array.isArray(value)) {
      if (value.length > 0) {
        (result as Record<string, unknown>)[key] = value.map((item) =>
          typeof item === "object" && item !== null
            ? removeEmpty(item, includeEmpty)
            : item
        );
      }
    } else {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result;
}

/**
 * Convert a node's meta to LLM-friendly format
 */
function convertMeta(
  meta: NodeMeta | undefined,
  options: LLMExportOptions
): LLMMeta | undefined {
  if (!meta) return undefined;

  const result: LLMMeta = {};

  if (meta.role) result.role = meta.role;
  if (meta.purpose) result.purpose = meta.purpose;
  if (meta.behavior) result.behavior = meta.behavior;
  if (meta.states && meta.states.length > 0) result.states = [...meta.states];
  if (meta.a11y) {
    result.a11y = {};
    if (meta.a11y.label) result.a11y.label = meta.a11y.label;
    if (meta.a11y.hint) result.a11y.hint = meta.a11y.hint;
    if (meta.a11y.role) result.a11y.role = meta.a11y.role;
    if (meta.a11y.live) result.a11y.live = meta.a11y.live;
  }
  if (meta.notes) result.notes = meta.notes;
  if (meta.related && meta.related.length > 0) result.related = [...meta.related];

  // Redact editor-only fields if requested
  // (autofilled, templateVersion are not included in LLMMeta by design)

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Resolve a style value using tokens
 */
function resolveStyleValue(
  value: string | number | undefined,
  tokens: DesignTokens,
  resolveTokens: boolean
): string | number | undefined {
  if (value === undefined) return undefined;
  if (!resolveTokens) return value;
  return resolveToken(value, tokens);
}

/**
 * Convert node style to LLM-friendly format with resolved tokens
 */
function convertStyle(
  style: NodeStyle | undefined,
  tokens: DesignTokens,
  options: LLMExportOptions
): LLMStyle | undefined {
  if (!style) return undefined;

  const result: LLMStyle = {};
  const resolve = (v: string | number | undefined) =>
    resolveStyleValue(v, tokens, options.resolveTokens);

  const bg = resolve(style.background);
  if (bg !== undefined) result.background = bg;

  const textColor = resolve(style.textColor);
  if (textColor !== undefined) result.textColor = textColor;

  const borderColor = resolve(style.borderColor);
  if (borderColor !== undefined) result.borderColor = borderColor;

  const borderWidth = resolve(style.borderWidth);
  if (borderWidth !== undefined) {
    result.borderWidth = typeof borderWidth === "number" ? borderWidth : parseFloat(borderWidth) || 0;
  }

  const borderRadius = resolve(style.borderRadius);
  if (borderRadius !== undefined) {
    result.borderRadius = typeof borderRadius === "number" ? borderRadius : parseFloat(borderRadius) || 0;
  }

  if (style.opacity !== undefined) result.opacity = style.opacity;

  const fontSize = resolve(style.fontSize);
  if (fontSize !== undefined) {
    result.fontSize = typeof fontSize === "number" ? fontSize : parseFloat(fontSize) || 16;
  }

  const fontFamily = resolve(style.fontFamily);
  if (fontFamily !== undefined) result.fontFamily = String(fontFamily);

  const fontWeight = resolve(style.fontWeight);
  if (fontWeight !== undefined) {
    result.fontWeight = typeof fontWeight === "number" ? fontWeight : parseInt(fontWeight, 10) || 400;
  }

  const lineHeight = resolve(style.lineHeight);
  if (lineHeight !== undefined) {
    result.lineHeight = typeof lineHeight === "number" ? lineHeight : parseFloat(lineHeight) || 1.5;
  }

  const shadow = resolve(style.shadow);
  if (shadow !== undefined) result.shadow = String(shadow);

  const padding = resolve(style.padding);
  if (padding !== undefined) {
    result.padding = typeof padding === "number" ? padding : parseFloat(padding) || 0;
  }

  const paddingTop = resolve(style.paddingTop);
  if (paddingTop !== undefined) {
    result.paddingTop = typeof paddingTop === "number" ? paddingTop : parseFloat(paddingTop) || 0;
  }

  const paddingRight = resolve(style.paddingRight);
  if (paddingRight !== undefined) {
    result.paddingRight = typeof paddingRight === "number" ? paddingRight : parseFloat(paddingRight) || 0;
  }

  const paddingBottom = resolve(style.paddingBottom);
  if (paddingBottom !== undefined) {
    result.paddingBottom = typeof paddingBottom === "number" ? paddingBottom : parseFloat(paddingBottom) || 0;
  }

  const paddingLeft = resolve(style.paddingLeft);
  if (paddingLeft !== undefined) {
    result.paddingLeft = typeof paddingLeft === "number" ? paddingLeft : parseFloat(paddingLeft) || 0;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Convert layout to LLM-friendly format
 */
function convertLayout(
  layout: NodeLayout,
  tokens: DesignTokens,
  options: LLMExportOptions,
  parentWidth: number,
  parentHeight: number
): LLMLayout {
  const result: LLMLayout = { mode: layout.mode };

  if (layout.mode === "anchored") {
    const anchored = layout as AnchoredLayout;
    result.anchorMin = [...anchored.anchorMin];
    result.anchorMax = [...anchored.anchorMax];
    result.pivot = [...anchored.pivot];
    result.anchoredPos = [...anchored.anchoredPos];
    result.sizeDelta = [...anchored.sizeDelta];

    // Calculate derived absolute rect
    if (options.includeAbsoluteRects) {
      const rect = anchoredToAbsolute(anchored, parentWidth, parentHeight);
      result.absoluteRect = {
        x: Math.round(rect.x * 100) / 100,
        y: Math.round(rect.y * 100) / 100,
        w: Math.round(rect.w * 100) / 100,
        h: Math.round(rect.h * 100) / 100,
      };
    }
  } else if (layout.mode === "absolute") {
    const absolute = layout as AbsoluteLayout;
    result.x = absolute.x;
    result.y = absolute.y;
    result.w = absolute.w;
    result.h = absolute.h;

    // For absolute layout, the absoluteRect is the same
    if (options.includeAbsoluteRects) {
      result.absoluteRect = {
        x: absolute.x,
        y: absolute.y,
        w: absolute.w,
        h: absolute.h,
      };
    }
  } else if (layout.mode === "auto") {
    const auto = layout as AutoLayout;
    result.direction = auto.direction;

    // Resolve token values for gap and padding
    if (auto.gap !== undefined) {
      const gap = options.resolveTokens ? resolveToken(auto.gap, tokens) : auto.gap;
      result.gap = typeof gap === "number" ? gap : parseFloat(gap as string) || 0;
    }

    if (auto.padding !== undefined) {
      const padding = options.resolveTokens ? resolveToken(auto.padding, tokens) : auto.padding;
      result.padding = typeof padding === "number" ? padding : parseFloat(padding as string) || 0;
    }

    if (auto.align) result.align = auto.align;
    if (auto.justify) result.justify = auto.justify;
    if (auto.wrap !== undefined) result.wrap = auto.wrap;
  }

  return result;
}

/**
 * Get the dimensions of a node for child layout calculations
 */
function getNodeDimensions(
  layout: NodeLayout,
  parentWidth: number,
  parentHeight: number
): { width: number; height: number } {
  if (layout.mode === "absolute") {
    const absolute = layout as AbsoluteLayout;
    return { width: absolute.w, height: absolute.h };
  } else if (layout.mode === "anchored") {
    const rect = anchoredToAbsolute(layout as AnchoredLayout, parentWidth, parentHeight);
    return { width: rect.w, height: rect.h };
  }
  // For auto layout, use parent dimensions as fallback
  return { width: parentWidth, height: parentHeight };
}

/**
 * Convert a UINode to LLM-friendly format
 */
function convertNode(
  node: UINode,
  tokens: DesignTokens,
  options: LLMExportOptions,
  parentWidth: number,
  parentHeight: number
): LLMNode {
  const result: LLMNode = {
    id: node.id,
    type: node.type,
    layout: convertLayout(node.layout, tokens, options, parentWidth, parentHeight),
  };

  if (node.name) result.name = node.name;

  // Extract role at top level for emphasis
  if (node.meta?.role) result.role = node.meta.role;

  // Convert meta
  const meta = convertMeta(node.meta, options);
  if (meta) result.meta = meta;

  // Include constraints (emphasized for LLM understanding)
  if (node.constraints) {
    result.constraints = { ...node.constraints };
  }

  // Convert style with resolved tokens
  const style = convertStyle(node.style, tokens, options);
  if (style) result.style = style;

  // Include content
  if (node.content && Object.keys(node.content).some((k) => (node.content as Record<string, unknown>)[k])) {
    result.content = { ...node.content };
  }

  // Include behavior
  if (node.behavior) {
    result.behavior = JSON.parse(JSON.stringify(node.behavior));
  }

  // Include binding
  if (node.bind) {
    result.bind = JSON.parse(JSON.stringify(node.bind));
  }

  // Convert children recursively
  if (node.children && node.children.length > 0) {
    const { width, height } = getNodeDimensions(node.layout, parentWidth, parentHeight);
    result.children = node.children.map((child) =>
      convertNode(child, tokens, options, width, height)
    );
  }

  return result;
}

/**
 * Convert a Screen to LLM-friendly format
 */
function convertScreen(
  screen: Screen,
  tokens: DesignTokens,
  options: LLMExportOptions
): LLMScreen {
  // Use contract or defaults
  const contract = screen.contract || createDefaultScreenContract();

  // Root dimensions from contract reference size
  const parentWidth = contract.referenceSize.w;
  const parentHeight = contract.referenceSize.h;

  return {
    id: screen.id,
    name: screen.name,
    description: screen.description,
    contract: { ...contract },
    root: convertNode(screen.root, tokens, options, parentWidth, parentHeight),
  };
}

/**
 * Generate LLM-friendly spec from a UIDocument
 */
export function generateLLMSpec(
  document: UIDocument,
  options: Partial<LLMExportOptions> = {}
): LLMSpec {
  const opts: LLMExportOptions = { ...DEFAULT_LLM_EXPORT_OPTIONS, ...options };

  const spec: LLMSpec = {
    $format: "llm-ui-spec",
    $version: "1.0",
    tokens: { ...document.tokens },
    screens: {},
  };

  if (document.name) spec.name = document.name;
  if (document.description) spec.description = document.description;

  // Convert screens with deterministic ordering by ID
  const screenIds = Object.keys(document.screens).sort();
  for (const screenId of screenIds) {
    const screen = document.screens[screenId];
    const converted = convertScreen(screen, document.tokens, opts);
    spec.screens[screenId] = removeEmpty(converted, opts.includeEmptyFields) as LLMScreen;
  }

  // Sort tokens alphabetically
  spec.tokens = sortObjectKeys(spec.tokens);

  return spec;
}

/**
 * Export LLM spec to a deterministic JSON string
 */
export function exportLLMSpecToJSON(
  document: UIDocument,
  options: Partial<LLMExportOptions> = {}
): string {
  const spec = generateLLMSpec(document, options);

  // Custom replacer for deterministic key ordering
  const sortedSpec = sortObjectKeys(spec);

  return JSON.stringify(sortedSpec, null, 2);
}
