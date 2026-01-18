import { TextFileView, WorkspaceLeaf, Menu } from "obsidian";
import { UIDocument, createNode, NodeType, UINode, AbsoluteLayout } from "../types/ui-schema";
import { EditorState, getEditorState } from "../state/EditorState";
import { CanvasRenderer } from "../canvas/CanvasRenderer";
import { CanvasInteraction } from "../canvas/CanvasInteraction";

export const UI_EDITOR_VIEW_TYPE = "ui-editor-view";

/**
 * Main editor view for .uidesign files
 * Provides a canvas-based UI layout designer with inline properties panel
 */
export class UIEditorView extends TextFileView {
  private state: EditorState;
  private canvas: HTMLCanvasElement | null = null;
  private renderer: CanvasRenderer | null = null;
  private interaction: CanvasInteraction | null = null;
  private propertiesPanel: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.state = getEditorState();
  }

  getViewType(): string {
    return UI_EDITOR_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.file?.basename || "UI Editor";
  }

  getIcon(): string {
    return "layout";
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("ui-editor-container");

    // Create toolbar
    const toolbar = container.createDiv({ cls: "ui-editor-toolbar" });
    this.createToolbar(toolbar);

    // Create main content area (canvas + properties)
    const mainArea = container.createDiv({ cls: "ui-editor-main" });

    // Create canvas container
    const canvasContainer = mainArea.createDiv({
      cls: "ui-editor-canvas-container",
    });

    // Create canvas
    this.canvas = canvasContainer.createEl("canvas", {
      cls: "ui-editor-canvas",
    });

    // Create properties panel
    this.propertiesPanel = mainArea.createDiv({ cls: "ui-editor-properties" });
    this.createPropertiesPanel(this.propertiesPanel);

    // Initialize renderer and interaction
    this.renderer = new CanvasRenderer(this.canvas, this.state);
    this.interaction = new CanvasInteraction(
      this.canvas,
      this.state,
      this.renderer
    );

    // Listen for state changes
    this.state.on("dirty-changed", (isDirty: unknown) => {
      if (isDirty) {
        this.requestSave();
      }
    });

    this.state.on("selection-changed", () => this.updatePropertiesPanel());
    this.state.on("node-updated", () => this.updatePropertiesPanel());
  }

  async onClose(): Promise<void> {
    this.renderer?.destroy();
    this.interaction?.destroy();
    this.canvas = null;
    this.renderer = null;
    this.interaction = null;
    this.propertiesPanel = null;
  }

  private createToolbar(container: HTMLElement): void {
    // Add node buttons
    const nodeTypes: { type: NodeType; label: string }[] = [
      { type: "Container", label: "Container" },
      { type: "Button", label: "Button" },
      { type: "Text", label: "Text" },
      { type: "Input", label: "Input" },
      { type: "Image", label: "Image" },
    ];

    const addGroup = container.createDiv({ cls: "ui-editor-toolbar-group" });
    addGroup.createSpan({ text: "Add:", cls: "ui-editor-toolbar-label" });

    for (const { type, label } of nodeTypes) {
      const btn = addGroup.createEl("button", {
        cls: "ui-editor-toolbar-btn",
        attr: { title: `Add ${label}` },
      });
      btn.textContent = label;
      btn.addEventListener("click", () => {
        this.interaction?.addNode(type);
      });
    }

    // Separator
    container.createDiv({ cls: "ui-editor-toolbar-separator" });

    // View controls
    const viewGroup = container.createDiv({ cls: "ui-editor-toolbar-group" });

    const resetViewBtn = viewGroup.createEl("button", {
      cls: "ui-editor-toolbar-btn",
      attr: { title: "Reset View" },
    });
    resetViewBtn.textContent = "Reset View";
    resetViewBtn.addEventListener("click", () => {
      this.state.setViewport({ panX: 50, panY: 50, zoom: 1 });
    });

    const zoomInBtn = viewGroup.createEl("button", {
      cls: "ui-editor-toolbar-btn",
      attr: { title: "Zoom In" },
    });
    zoomInBtn.textContent = "+";
    zoomInBtn.addEventListener("click", () => {
      const viewport = this.state.getViewport();
      this.state.setViewport({ zoom: Math.min(viewport.zoom * 1.2, 5) });
    });

    const zoomOutBtn = viewGroup.createEl("button", {
      cls: "ui-editor-toolbar-btn",
      attr: { title: "Zoom Out" },
    });
    zoomOutBtn.textContent = "-";
    zoomOutBtn.addEventListener("click", () => {
      const viewport = this.state.getViewport();
      this.state.setViewport({ zoom: Math.max(viewport.zoom / 1.2, 0.1) });
    });

    // Separator
    container.createDiv({ cls: "ui-editor-toolbar-separator" });

    // Snap controls
    const snapGroup = container.createDiv({ cls: "ui-editor-toolbar-group" });

    const snapBtn = snapGroup.createEl("button", {
      cls: "ui-editor-toolbar-btn ui-editor-toolbar-btn-toggle is-active",
      attr: { title: "Toggle Snap to Grid" },
    });
    snapBtn.textContent = "Snap: On";
    snapBtn.addEventListener("click", () => {
      if (this.interaction) {
        const newState = !this.interaction.isSnapEnabled();
        this.interaction.setSnapEnabled(newState);
        snapBtn.textContent = newState ? "Snap: On" : "Snap: Off";
        snapBtn.toggleClass("is-active", newState);
      }
    });
  }

  private createPropertiesPanel(container: HTMLElement): void {
    container.createDiv({ cls: "ui-editor-properties-header", text: "Properties" });
    container.createDiv({ cls: "ui-editor-properties-content" });
    this.updatePropertiesPanel();
  }

  private updatePropertiesPanel(): void {
    if (!this.propertiesPanel) return;

    const content = this.propertiesPanel.querySelector(".ui-editor-properties-content");
    if (!content) return;

    content.empty();

    const selectedNode = this.state.getSelectedNode();

    if (!selectedNode) {
      content.createDiv({
        cls: "ui-editor-properties-empty",
        text: "Select a node to edit properties",
      });
      return;
    }

    // Node name
    this.createField(content as HTMLElement, "Name", "text", selectedNode.name || selectedNode.type, (val) => {
      this.state.updateNode(selectedNode.id, { name: val });
    });

    // Type (read-only)
    this.createReadOnlyField(content as HTMLElement, "Type", selectedNode.type);

    // Layout fields (if absolute)
    if (selectedNode.layout.mode === "absolute") {
      const layout = selectedNode.layout as AbsoluteLayout;

      content.createDiv({ cls: "ui-editor-properties-section-title", text: "Position & Size" });

      const posRow = (content as HTMLElement).createDiv({ cls: "ui-editor-properties-row-multi" });
      this.createSmallNumberField(posRow, "X", layout.x, (val) => {
        this.state.updateNodeLayout(selectedNode.id, { ...layout, x: val });
      });
      this.createSmallNumberField(posRow, "Y", layout.y, (val) => {
        this.state.updateNodeLayout(selectedNode.id, { ...layout, y: val });
      });
      this.createSmallNumberField(posRow, "W", layout.w, (val) => {
        this.state.updateNodeLayout(selectedNode.id, { ...layout, w: val });
      });
      this.createSmallNumberField(posRow, "H", layout.h, (val) => {
        this.state.updateNodeLayout(selectedNode.id, { ...layout, h: val });
      });
    }

    // Style section
    content.createDiv({ cls: "ui-editor-properties-section-title", text: "Style" });

    const style = selectedNode.style || {};

    this.createColorField(content as HTMLElement, "Background Color", style.background || "", (val) => {
      this.state.updateNodeStyle(selectedNode.id, { background: val });
    });

    this.createColorField(content as HTMLElement, "Text Color", style.textColor || "", (val) => {
      this.state.updateNodeStyle(selectedNode.id, { textColor: val });
    });

    // Content section
    if (selectedNode.content?.text !== undefined || ["Button", "Text"].includes(selectedNode.type)) {
      content.createDiv({ cls: "ui-editor-properties-section-title", text: "Content" });

      this.createField(content as HTMLElement, "Text", "text", selectedNode.content?.text || "", (val) => {
        this.state.updateNode(selectedNode.id, {
          content: { ...selectedNode.content, text: val },
        });
      });
    }

    // Description (meta.purpose)
    content.createDiv({ cls: "ui-editor-properties-section-title", text: "Documentation" });

    this.createTextArea(content as HTMLElement, "Description", selectedNode.meta?.purpose || "", (val) => {
      this.state.updateNode(selectedNode.id, {
        meta: { ...selectedNode.meta, purpose: val },
      });
    });

    this.createTextArea(content as HTMLElement, "Behavior", selectedNode.meta?.behavior || "", (val) => {
      this.state.updateNode(selectedNode.id, {
        meta: { ...selectedNode.meta, behavior: val },
      });
    });

    this.createField(content as HTMLElement, "States", "text", (selectedNode.meta?.states || []).join(", "), (val) => {
      const states = val.split(",").map(s => s.trim()).filter(s => s);
      this.state.updateNode(selectedNode.id, {
        meta: { ...selectedNode.meta, states },
      });
    });

    this.createField(content as HTMLElement, "Related", "text", (selectedNode.meta?.related || []).join(", "), (val) => {
      const related = val.split(",").map(s => s.trim()).filter(s => s);
      this.state.updateNode(selectedNode.id, {
        meta: { ...selectedNode.meta, related },
      });
    });
  }

  private createField(
    parent: HTMLElement,
    label: string,
    type: string,
    value: string,
    onChange: (val: string) => void
  ): void {
    const row = parent.createDiv({ cls: "ui-editor-properties-row" });
    row.createSpan({ cls: "ui-editor-properties-label", text: label });
    const input = row.createEl("input", {
      type,
      value,
      cls: "ui-editor-properties-input",
    });
    input.addEventListener("change", () => onChange(input.value));
  }

  private createSmallNumberField(
    parent: HTMLElement,
    label: string,
    value: number,
    onChange: (val: number) => void
  ): void {
    const group = parent.createDiv({ cls: "ui-editor-properties-small-field" });
    group.createSpan({ cls: "ui-editor-properties-small-label", text: label });
    const input = group.createEl("input", {
      type: "number",
      value: String(value),
      cls: "ui-editor-properties-small-input",
    });
    input.addEventListener("change", () => {
      const num = parseFloat(input.value);
      if (!isNaN(num)) onChange(num);
    });
  }

  private createColorField(
    parent: HTMLElement,
    label: string,
    value: string,
    onChange: (val: string) => void
  ): void {
    const row = parent.createDiv({ cls: "ui-editor-properties-row" });
    row.createSpan({ cls: "ui-editor-properties-label", text: label });

    const group = row.createDiv({ cls: "ui-editor-properties-color-group" });

    const colorPicker = group.createEl("input", {
      type: "color",
      cls: "ui-editor-properties-color-picker",
    });

    const textInput = group.createEl("input", {
      type: "text",
      value,
      cls: "ui-editor-properties-input ui-editor-properties-color-text",
      attr: { placeholder: "#000000" },
    });

    // Set color picker value
    if (/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(value)) {
      colorPicker.value = value;
    } else {
      colorPicker.value = "#000000";
    }

    colorPicker.addEventListener("input", () => {
      textInput.value = colorPicker.value;
      onChange(colorPicker.value);
    });

    textInput.addEventListener("change", () => {
      if (/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(textInput.value)) {
        colorPicker.value = textInput.value;
      }
      onChange(textInput.value);
    });
  }

  private createTextArea(
    parent: HTMLElement,
    label: string,
    value: string,
    onChange: (val: string) => void
  ): void {
    const row = parent.createDiv({ cls: "ui-editor-properties-row ui-editor-properties-row-vertical" });
    row.createSpan({ cls: "ui-editor-properties-label", text: label });
    const textarea = row.createEl("textarea", {
      cls: "ui-editor-properties-textarea",
    });
    textarea.value = value;
    textarea.addEventListener("change", () => onChange(textarea.value));
  }

  private createReadOnlyField(parent: HTMLElement, label: string, value: string): void {
    const row = parent.createDiv({ cls: "ui-editor-properties-row" });
    row.createSpan({ cls: "ui-editor-properties-label", text: label });
    row.createSpan({ cls: "ui-editor-properties-value-readonly", text: value });
  }

  // TextFileView methods
  getViewData(): string {
    return this.state.serialize();
  }

  setViewData(data: string, clear: boolean): void {
    if (clear) {
      this.clear();
    }

    try {
      let doc: UIDocument;

      if (!data || data.trim() === "") {
        doc = this.state.createNewDocument(this.file?.basename);
      } else {
        doc = JSON.parse(data);

        if (!doc.tokens) doc.tokens = {};
        if (!doc.components) doc.components = {};
        if (!doc.screens) doc.screens = {};

        if (Object.keys(doc.screens).length === 0) {
          doc.screens["main"] = {
            id: "main",
            name: "Main Screen",
            root: {
              id: "root",
              type: "Container",
              name: "Root",
              layout: { mode: "absolute", x: 0, y: 0, w: 375, h: 667 },
              style: { background: "#ffffff" },
              children: [],
            },
          };
        }
      }

      this.state.loadDocument(doc, this.file!);
      this.state.setViewport({ panX: 50, panY: 50, zoom: 1 });
      this.updatePropertiesPanel();
    } catch (e) {
      console.error("Failed to parse UI document:", e);
      const doc = this.state.createNewDocument(this.file?.basename);
      this.state.loadDocument(doc, this.file!);
    }
  }

  clear(): void {
    this.state.clearSelection();
  }

  onPaneMenu(menu: Menu, source: string): void {
    super.onPaneMenu(menu, source);

    menu.addItem((item) => {
      item
        .setTitle("Reset View")
        .setIcon("refresh-cw")
        .onClick(() => {
          this.state.setViewport({ panX: 50, panY: 50, zoom: 1 });
        });
    });
  }
}
