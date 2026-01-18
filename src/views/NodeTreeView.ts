import { ItemView, WorkspaceLeaf } from "obsidian";
import { UINode } from "../types/ui-schema";
import { EditorState, getEditorState } from "../state/EditorState";

export const NODE_TREE_VIEW_TYPE = "ui-node-tree-view";

/**
 * Left panel - Hierarchical tree view of all UI nodes
 */
export class NodeTreeView extends ItemView {
  private state: EditorState;
  private treeContainer: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.state = getEditorState();
  }

  getViewType(): string {
    return NODE_TREE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "UI Hierarchy";
  }

  getIcon(): string {
    return "list-tree";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("ui-node-tree-container");

    // Header
    const header = container.createDiv({ cls: "ui-node-tree-header" });
    header.createSpan({ text: "Node Tree", cls: "ui-node-tree-title" });

    // Tree container
    this.treeContainer = container.createDiv({ cls: "ui-node-tree-content" });

    // Listen for state changes
    this.state.on("document-loaded", () => this.refresh());
    this.state.on("screen-changed", () => this.refresh());
    this.state.on("node-added", () => this.refresh());
    this.state.on("node-removed", () => this.refresh());
    this.state.on("node-updated", () => this.refresh());
    this.state.on("selection-changed", () => this.updateSelection());

    this.refresh();
  }

  async onClose(): Promise<void> {
    this.treeContainer = null;
  }

  private refresh(): void {
    if (!this.treeContainer) return;
    this.treeContainer.empty();

    const screen = this.state.getCurrentScreen();
    if (!screen) {
      this.treeContainer.createSpan({
        text: "No document loaded",
        cls: "ui-node-tree-empty",
      });
      return;
    }

    // Screen selector if multiple screens
    const doc = this.state.getDocument();
    if (doc && Object.keys(doc.screens).length > 1) {
      const screenSelect = this.treeContainer.createEl("select", {
        cls: "ui-node-tree-screen-select",
      });

      for (const [id, scr] of Object.entries(doc.screens)) {
        const option = screenSelect.createEl("option", {
          value: id,
          text: scr.name || id,
        });
        if (id === screen.id) {
          option.selected = true;
        }
      }

      screenSelect.addEventListener("change", () => {
        this.state.setCurrentScreen(screenSelect.value);
      });
    }

    // Render tree
    const treeRoot = this.treeContainer.createDiv({ cls: "ui-node-tree-root" });
    this.renderNode(screen.root, treeRoot, 0);
  }

  private renderNode(
    node: UINode,
    container: HTMLElement,
    depth: number
  ): void {
    const isSelected = this.state.isNodeSelected(node.id);
    const hasChildren = node.children && node.children.length > 0;

    const nodeEl = container.createDiv({
      cls: `ui-node-tree-item ${isSelected ? "is-selected" : ""}`,
      attr: { "data-node-id": node.id },
    });
    nodeEl.style.paddingLeft = `${depth * 16 + 8}px`;

    // Expand/collapse toggle
    if (hasChildren) {
      const toggle = nodeEl.createSpan({ cls: "ui-node-tree-toggle" });
      toggle.textContent = "▼";
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const childContainer = nodeEl.nextElementSibling;
        if (childContainer?.hasClass("ui-node-tree-children")) {
          const isCollapsed = childContainer.hasClass("is-collapsed");
          childContainer.toggleClass("is-collapsed", !isCollapsed);
          toggle.textContent = isCollapsed ? "▼" : "▶";
        }
      });
    } else {
      nodeEl.createSpan({ cls: "ui-node-tree-toggle-spacer" });
    }

    // Type icon
    const icon = this.getNodeIcon(node.type);
    nodeEl.createSpan({ text: icon, cls: "ui-node-tree-icon" });

    // Node name
    const name = node.name || node.type;
    nodeEl.createSpan({ text: name, cls: "ui-node-tree-name" });

    // Click to select
    nodeEl.addEventListener("click", (e) => {
      const addToSelection = e.shiftKey || e.ctrlKey || e.metaKey;
      if (addToSelection && this.state.isNodeSelected(node.id)) {
        this.state.deselectNode(node.id);
      } else {
        this.state.selectNode(node.id, addToSelection);
      }
    });

    // Double-click to focus in canvas (future: edit name)
    nodeEl.addEventListener("dblclick", () => {
      // Could implement inline rename here
    });

    // Render children
    if (hasChildren) {
      const childContainer = container.createDiv({
        cls: "ui-node-tree-children",
      });
      for (const child of node.children!) {
        this.renderNode(child, childContainer, depth + 1);
      }
    }
  }

  private getNodeIcon(type: string): string {
    const icons: { [key: string]: string } = {
      Container: "□",
      Button: "▣",
      Text: "T",
      Input: "▭",
      Image: "▨",
      Icon: "◉",
      Divider: "—",
      Spacer: "⋮",
      Card: "▢",
      List: "☰",
      ListItem: "•",
      Header: "▔",
      Footer: "▁",
      Sidebar: "▌",
      Modal: "◫",
      Custom: "✧",
    };
    return icons[type] || "○";
  }

  private updateSelection(): void {
    if (!this.treeContainer) return;

    const selectedIds = new Set(this.state.getSelectedNodeIds());

    this.treeContainer.querySelectorAll(".ui-node-tree-item").forEach((el) => {
      const nodeId = el.getAttribute("data-node-id");
      if (nodeId) {
        el.toggleClass("is-selected", selectedIds.has(nodeId));
      }
    });
  }
}
