import { UIDocument, UINode, Screen, DesignTokens } from "../types/ui-schema";

/**
 * Generates Markdown documentation from a UI design document
 */
export class MarkdownGenerator {
  /**
   * Generate full Markdown documentation for a UI document
   */
  static generate(doc: UIDocument): string {
    const lines: string[] = [];

    // Title
    lines.push(`# ${doc.name || "UI Design"}`);
    lines.push("");

    if (doc.description) {
      lines.push(doc.description);
      lines.push("");
    }

    // Design Tokens section
    if (Object.keys(doc.tokens).length > 0) {
      lines.push("## Design Tokens");
      lines.push("");
      lines.push(this.generateTokensTable(doc.tokens));
      lines.push("");
    }

    // Screens section
    const screenIds = Object.keys(doc.screens);
    if (screenIds.length > 0) {
      lines.push("## Screens");
      lines.push("");

      for (const screenId of screenIds) {
        const screen = doc.screens[screenId];
        lines.push(...this.generateScreenSection(screen));
        lines.push("");
      }
    }

    // Components section
    const componentIds = Object.keys(doc.components);
    if (componentIds.length > 0) {
      lines.push("## Components");
      lines.push("");

      for (const compId of componentIds) {
        const comp = doc.components[compId];
        lines.push(`### ${comp.name}`);
        lines.push("");
        if (comp.description) {
          lines.push(comp.description);
          lines.push("");
        }
        lines.push(...this.generateNodeTree(comp.root, 0));
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  /**
   * Generate a Markdown table for design tokens
   */
  private static generateTokensTable(tokens: DesignTokens): string {
    const lines: string[] = [];
    lines.push("| Token | Value |");
    lines.push("|-------|-------|");

    // Group tokens by prefix
    const grouped: { [prefix: string]: { name: string; value: string | number }[] } = {};

    for (const [name, value] of Object.entries(tokens)) {
      const prefix = name.split(".")[0];
      if (!grouped[prefix]) {
        grouped[prefix] = [];
      }
      grouped[prefix].push({ name, value });
    }

    for (const prefix of Object.keys(grouped).sort()) {
      for (const { name, value } of grouped[prefix]) {
        const displayValue = typeof value === "string" && value.startsWith("#")
          ? `\`${value}\` ${this.colorSwatch(value)}`
          : `\`${value}\``;
        lines.push(`| \`${name}\` | ${displayValue} |`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Generate a color swatch indicator for hex colors
   */
  private static colorSwatch(hex: string): string {
    // Return an HTML span with background color (works in some Markdown renderers)
    return `<span style="display:inline-block;width:12px;height:12px;background:${hex};border:1px solid #ccc;border-radius:2px;"></span>`;
  }

  /**
   * Generate documentation section for a screen
   */
  private static generateScreenSection(screen: Screen): string[] {
    const lines: string[] = [];

    lines.push(`### ${screen.name || screen.id}`);
    lines.push("");

    if (screen.description) {
      lines.push(screen.description);
      lines.push("");
    }

    // Screen dimensions
    if (screen.root.layout.mode === "absolute") {
      lines.push(`**Dimensions:** ${screen.root.layout.w} × ${screen.root.layout.h}`);
      lines.push("");
    }

    // Node hierarchy
    lines.push("#### Elements");
    lines.push("");
    lines.push(...this.generateNodeTree(screen.root, 0));

    return lines;
  }

  /**
   * Generate a tree representation of nodes
   */
  private static generateNodeTree(node: UINode, depth: number): string[] {
    const lines: string[] = [];
    const indent = "  ".repeat(depth);
    const bullet = depth === 0 ? "" : "- ";

    // Node header
    const name = node.name || node.type;
    const typeTag = node.name ? ` \`${node.type}\`` : "";

    if (depth === 0) {
      lines.push(`**${name}**${typeTag}`);
    } else {
      lines.push(`${indent}${bullet}**${name}**${typeTag}`);
    }

    // Node details (only for non-root nodes with meta)
    if (node.meta?.purpose || node.meta?.behavior) {
      if (node.meta.purpose) {
        lines.push(`${indent}  - *Purpose:* ${node.meta.purpose}`);
      }
      if (node.meta.behavior) {
        lines.push(`${indent}  - *Behavior:* ${node.meta.behavior}`);
      }
      if (node.meta.states && node.meta.states.length > 0) {
        lines.push(`${indent}  - *States:* ${node.meta.states.join(", ")}`);
      }
      if (node.meta.notes) {
        lines.push(`${indent}  - *Notes:* ${node.meta.notes}`);
      }
    }

    // Content
    if (node.content?.text) {
      lines.push(`${indent}  - *Text:* "${node.content.text}"`);
    }

    // Children
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        lines.push(...this.generateNodeTree(child, depth + 1));
      }
    }

    return lines;
  }

  /**
   * Generate a summary of all elements with their purposes
   */
  static generateElementSummary(doc: UIDocument): string {
    const lines: string[] = [];
    lines.push("## Element Summary");
    lines.push("");
    lines.push("| Element | Type | Purpose |");
    lines.push("|---------|------|---------|");

    for (const screen of Object.values(doc.screens)) {
      this.collectElements(screen.root, lines);
    }

    return lines.join("\n");
  }

  private static collectElements(node: UINode, lines: string[]): void {
    const name = node.name || node.id;
    const purpose = node.meta?.purpose || "-";
    lines.push(`| ${name} | ${node.type} | ${purpose} |`);

    if (node.children) {
      for (const child of node.children) {
        this.collectElements(child, lines);
      }
    }
  }
}
