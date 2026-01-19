import { ItemView, WorkspaceLeaf } from "obsidian";
import { UINode } from "../types/ui-schema";
import { EditorState, getEditorStateManager } from "../state/EditorState";

export const NODE_TREE_VIEW_TYPE = "ui-node-tree-view";

type StateEventCallback = (...args: unknown[]) => void;

/**
 * Left panel - Hierarchical tree view of all UI nodes
 */
export class NodeTreeView extends ItemView {
  private state: EditorState | null = null;
  private treeContainer: HTMLElement | null = null;
  private stateEventHandlers: Map<string, StateEventCallback> = new Map();
  private activeStateChangedHandler: ((state: EditorState | null) => void) | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  /**
   * Subscribe to events on the current state
   */
  private subscribeToState(state: EditorState | null): void {
    // Unsubscribe from old state
    this.unsubscribeFromState();

    this.state = state;

    if (!state) {
      this.refresh();
      return;
    }

    // Create handlers
    const refreshHandler = () => this.refresh();
    const selectionHandler = () => this.updateSelection();

    // Store handlers for cleanup
    this.stateEventHandlers.set("document-loaded", refreshHandler);
    this.stateEventHandlers.set("screen-changed", refreshHandler);
    this.stateEventHandlers.set("node-added", refreshHandler);
    this.stateEventHandlers.set("node-removed", refreshHandler);
    this.stateEventHandlers.set("node-updated", refreshHandler);
    this.stateEventHandlers.set("selection-changed", selectionHandler);

    // Subscribe
    state.on("document-loaded", refreshHandler);
    state.on("screen-changed", refreshHandler);
    state.on("node-added", refreshHandler);
    state.on("node-removed", refreshHandler);
    state.on("node-updated", refreshHandler);
    state.on("selection-changed", selectionHandler);

    this.refresh();
  }

  /**
   * Unsubscribe from current state's events
   */
  private unsubscribeFromState(): void {
    if (!this.state) return;

    for (const [event, handler] of this.stateEventHandlers) {
      this.state.off(event, handler);
    }
    this.stateEventHandlers.clear();
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

    // Listen for active state changes from the manager
    const manager = getEditorStateManager();
    this.activeStateChangedHandler = (state: EditorState | null) => {
      this.subscribeToState(state);
    };
    manager.on("active-state-changed", this.activeStateChangedHandler);

    // Subscribe to current active state
    this.subscribeToState(manager.getActiveState());
  }

  async onClose(): Promise<void> {
    // Unsubscribe from state events
    this.unsubscribeFromState();

    // Unsubscribe from manager events
    if (this.activeStateChangedHandler) {
      getEditorStateManager().off("active-state-changed", this.activeStateChangedHandler);
      this.activeStateChangedHandler = null;
    }

    this.treeContainer = null;
  }

  private refresh(): void {
    if (!this.treeContainer) return;
    this.treeContainer.empty();

    if (!this.state) {
      this.treeContainer.createSpan({
        text: "No document loaded",
        cls: "ui-node-tree-empty",
      });
      return;
    }

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
        this.state?.setCurrentScreen(screenSelect.value);
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
    if (!this.state) return;

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
      if (!this.state) return;
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
    if (!this.treeContainer || !this.state) return;

    const selectedIds = new Set(this.state.getSelectedNodeIds());

    this.treeContainer.querySelectorAll(".ui-node-tree-item").forEach((el) => {
      const nodeId = el.getAttribute("data-node-id");
      if (nodeId) {
        el.toggleClass("is-selected", selectedIds.has(nodeId));
      }
    });
  }
}
