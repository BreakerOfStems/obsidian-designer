import { ItemView, WorkspaceLeaf } from "obsidian";
import { DesignTokens, getTokenCategories, getTokensByCategory } from "../types/ui-schema";
import { EditorState, getEditorStateManager } from "../state/EditorState";

export const TOKEN_BROWSER_VIEW_TYPE = "ui-token-browser-view";

type StateEventCallback = (...args: unknown[]) => void;

/**
 * Token Browser - displays and allows editing of design tokens
 */
export class TokenBrowserView extends ItemView {
  private state: EditorState | null = null;
  private contentContainer: HTMLElement | null = null;
  private stateEventHandlers: Map<string, StateEventCallback> = new Map();
  private activeStateChangedHandler: ((state: EditorState | null) => void) | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  private subscribeToState(state: EditorState | null): void {
    this.unsubscribeFromState();
    this.state = state;

    if (!state) {
      this.refresh();
      return;
    }

    const refreshHandler = () => this.refresh();
    this.stateEventHandlers.set("document-loaded", refreshHandler);
    this.stateEventHandlers.set("tokens-changed", refreshHandler);

    state.on("document-loaded", refreshHandler);
    state.on("tokens-changed", refreshHandler);

    this.refresh();
  }

  private unsubscribeFromState(): void {
    if (!this.state) return;

    for (const [event, handler] of this.stateEventHandlers) {
      this.state.off(event, handler);
    }
    this.stateEventHandlers.clear();
  }

  getViewType(): string {
    return TOKEN_BROWSER_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Design Tokens";
  }

  getIcon(): string {
    return "palette";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("ui-token-browser-container");

    // Header
    const header = container.createDiv({ cls: "ui-token-browser-header" });
    header.createSpan({ text: "Design Tokens", cls: "ui-token-browser-title" });

    // Add token button
    const addBtn = header.createEl("button", {
      cls: "ui-token-browser-add-btn",
      text: "+",
      attr: { title: "Add new token" },
    });
    addBtn.addEventListener("click", () => this.showAddTokenDialog());

    // Content
    this.contentContainer = container.createDiv({
      cls: "ui-token-browser-content",
    });

    // Listen for active state changes
    const manager = getEditorStateManager();
    this.activeStateChangedHandler = (state: EditorState | null) => {
      this.subscribeToState(state);
    };
    manager.on("active-state-changed", this.activeStateChangedHandler);

    this.subscribeToState(manager.getActiveState());
  }

  async onClose(): Promise<void> {
    this.unsubscribeFromState();

    if (this.activeStateChangedHandler) {
      getEditorStateManager().off("active-state-changed", this.activeStateChangedHandler);
      this.activeStateChangedHandler = null;
    }

    this.contentContainer = null;
  }

  private refresh(): void {
    if (!this.contentContainer) return;
    this.contentContainer.empty();

    const state = this.state;
    if (!state) {
      this.contentContainer.createSpan({
        text: "No document loaded",
        cls: "ui-token-browser-empty",
      });
      return;
    }

    const doc = state.getDocument();
    if (!doc) {
      this.contentContainer.createSpan({
        text: "No document loaded",
        cls: "ui-token-browser-empty",
      });
      return;
    }

    const tokens = doc.tokens;
    const categories = getTokenCategories(tokens);

    if (categories.length === 0) {
      this.contentContainer.createSpan({
        text: "No tokens defined",
        cls: "ui-token-browser-empty",
      });
      return;
    }

    // Render each category
    for (const category of categories) {
      this.renderCategory(category, tokens);
    }
  }

  private renderCategory(category: string, allTokens: DesignTokens): void {
    if (!this.contentContainer) return;

    const categoryTokens = getTokensByCategory(allTokens, category);
    const tokenKeys = Object.keys(categoryTokens);

    if (tokenKeys.length === 0) return;

    const section = this.contentContainer.createDiv({ cls: "ui-token-category" });

    // Category header
    const header = section.createDiv({ cls: "ui-token-category-header" });
    const toggle = header.createSpan({
      text: "▼",
      cls: "ui-token-category-toggle",
    });
    header.createSpan({ text: this.formatCategoryName(category), cls: "ui-token-category-title" });
    header.createSpan({ text: `(${tokenKeys.length})`, cls: "ui-token-category-count" });

    const content = section.createDiv({ cls: "ui-token-category-content" });

    // Render tokens in this category
    for (const key of tokenKeys) {
      this.renderToken(content, key, categoryTokens[key]);
    }

    // Toggle collapse
    header.addEventListener("click", () => {
      const isCollapsed = content.hasClass("is-collapsed");
      content.toggleClass("is-collapsed", !isCollapsed);
      toggle.textContent = isCollapsed ? "▼" : "▶";
    });
  }

  private renderToken(
    parent: HTMLElement,
    key: string,
    value: string | number
  ): void {
    const row = parent.createDiv({ cls: "ui-token-row" });

    // Token name (last part of key)
    const nameParts = key.split(".");
    const shortName = nameParts[nameParts.length - 1];
    row.createSpan({ text: shortName, cls: "ui-token-name", attr: { title: key } });

    // Preview based on type
    const previewContainer = row.createDiv({ cls: "ui-token-preview" });
    this.renderTokenPreview(previewContainer, key, value);

    // Value display
    const valueSpan = row.createSpan({
      text: String(value),
      cls: "ui-token-value",
    });

    // Make row clickable to edit
    row.addEventListener("click", () => {
      this.showEditTokenDialog(key, value);
    });

    // Delete button
    const deleteBtn = row.createEl("button", {
      cls: "ui-token-delete-btn",
      text: "×",
      attr: { title: "Delete token" },
    });
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.deleteToken(key);
    });
  }

  private renderTokenPreview(
    container: HTMLElement,
    key: string,
    value: string | number
  ): void {
    // Color preview
    if (key.startsWith("color.")) {
      const swatch = container.createDiv({ cls: "ui-token-color-swatch" });
      swatch.style.backgroundColor = String(value);
      return;
    }

    // Spacing preview
    if (key.startsWith("space.")) {
      const bar = container.createDiv({ cls: "ui-token-spacing-bar" });
      const size = Math.min(Number(value), 48); // Cap at 48px for display
      bar.style.width = `${size}px`;
      return;
    }

    // Radius preview
    if (key.startsWith("radius.")) {
      const box = container.createDiv({ cls: "ui-token-radius-box" });
      box.style.borderRadius = `${value}px`;
      return;
    }

    // Typography font preview
    if (key.startsWith("type.font.")) {
      const preview = container.createSpan({ text: "Aa", cls: "ui-token-font-preview" });
      preview.style.fontFamily = String(value);
      return;
    }

    // Typography size preview
    if (key.startsWith("type.size.")) {
      const preview = container.createSpan({ text: "Aa", cls: "ui-token-size-preview" });
      const size = Math.min(Number(value), 24); // Cap for display
      preview.style.fontSize = `${size}px`;
      return;
    }

    // Typography weight preview
    if (key.startsWith("type.weight.")) {
      const preview = container.createSpan({ text: "Aa", cls: "ui-token-weight-preview" });
      preview.style.fontWeight = String(value);
      return;
    }

    // Elevation preview
    if (key.startsWith("elevation.")) {
      const box = container.createDiv({ cls: "ui-token-elevation-box" });
      if (value !== "none") {
        box.style.boxShadow = String(value);
      }
      return;
    }
  }

  private formatCategoryName(category: string): string {
    // Convert "type.font" to "Typography / Font"
    const parts = category.split(".");
    return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" / ");
  }

  private showAddTokenDialog(): void {
    const state = this.state;
    if (!state) return;

    // Create modal
    const modal = document.body.createDiv({ cls: "ui-token-modal" });
    const backdrop = modal.createDiv({ cls: "ui-token-modal-backdrop" });
    const dialog = modal.createDiv({ cls: "ui-token-modal-dialog" });

    dialog.createEl("h3", { text: "Add New Token" });

    // Token key input
    const keyRow = dialog.createDiv({ cls: "ui-token-modal-row" });
    keyRow.createSpan({ text: "Key:" });
    const keyInput = keyRow.createEl("input", {
      type: "text",
      cls: "ui-token-modal-input",
      attr: { placeholder: "e.g., color.accent or space.2xs" },
    });

    // Token value input
    const valueRow = dialog.createDiv({ cls: "ui-token-modal-row" });
    valueRow.createSpan({ text: "Value:" });
    const valueInput = valueRow.createEl("input", {
      type: "text",
      cls: "ui-token-modal-input",
      attr: { placeholder: "e.g., #FF0000 or 4" },
    });

    // Buttons
    const btnRow = dialog.createDiv({ cls: "ui-token-modal-buttons" });
    const cancelBtn = btnRow.createEl("button", { text: "Cancel" });
    const addBtn = btnRow.createEl("button", { text: "Add", cls: "ui-token-modal-primary" });

    cancelBtn.addEventListener("click", () => modal.remove());
    backdrop.addEventListener("click", () => modal.remove());

    addBtn.addEventListener("click", () => {
      const key = keyInput.value.trim();
      const rawValue = valueInput.value.trim();

      if (!key || !rawValue) return;

      // Parse value (try number first)
      const numValue = parseFloat(rawValue);
      const value = !isNaN(numValue) && !rawValue.startsWith("#") ? numValue : rawValue;

      state.updateToken(key, value);
      modal.remove();
    });

    keyInput.focus();
  }

  private showEditTokenDialog(key: string, currentValue: string | number): void {
    const state = this.state;
    if (!state) return;

    // Create modal
    const modal = document.body.createDiv({ cls: "ui-token-modal" });
    const backdrop = modal.createDiv({ cls: "ui-token-modal-backdrop" });
    const dialog = modal.createDiv({ cls: "ui-token-modal-dialog" });

    dialog.createEl("h3", { text: "Edit Token" });

    // Token key display (read-only)
    const keyRow = dialog.createDiv({ cls: "ui-token-modal-row" });
    keyRow.createSpan({ text: "Key:" });
    keyRow.createSpan({ text: key, cls: "ui-token-modal-key" });

    // Token value input
    const valueRow = dialog.createDiv({ cls: "ui-token-modal-row" });
    valueRow.createSpan({ text: "Value:" });
    const valueInput = valueRow.createEl("input", {
      type: "text",
      value: String(currentValue),
      cls: "ui-token-modal-input",
    });

    // Color picker if it's a color token
    if (key.startsWith("color.") && typeof currentValue === "string" && currentValue.startsWith("#")) {
      const colorRow = dialog.createDiv({ cls: "ui-token-modal-row" });
      colorRow.createSpan({ text: "Pick:" });
      const colorInput = colorRow.createEl("input", {
        type: "color",
        value: currentValue,
        cls: "ui-token-modal-color",
      });
      colorInput.addEventListener("input", () => {
        valueInput.value = colorInput.value;
      });
    }

    // Buttons
    const btnRow = dialog.createDiv({ cls: "ui-token-modal-buttons" });
    const cancelBtn = btnRow.createEl("button", { text: "Cancel" });
    const saveBtn = btnRow.createEl("button", { text: "Save", cls: "ui-token-modal-primary" });

    cancelBtn.addEventListener("click", () => modal.remove());
    backdrop.addEventListener("click", () => modal.remove());

    saveBtn.addEventListener("click", () => {
      const rawValue = valueInput.value.trim();
      if (!rawValue) return;

      // Parse value (try number first)
      const numValue = parseFloat(rawValue);
      const value = !isNaN(numValue) && !rawValue.startsWith("#") ? numValue : rawValue;

      state.updateToken(key, value);
      modal.remove();
    });

    valueInput.focus();
    valueInput.select();
  }

  private deleteToken(key: string): void {
    const state = this.state;
    if (!state) return;

    // Simple confirmation
    if (confirm(`Delete token "${key}"?`)) {
      state.deleteToken(key);
    }
  }
}
