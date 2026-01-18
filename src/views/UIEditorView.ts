import { TextFileView, WorkspaceLeaf, Menu } from "obsidian";
import { UIDocument, NodeType } from "../types/ui-schema";
import { EditorState, getEditorState } from "../state/EditorState";
import { CanvasRenderer } from "../canvas/CanvasRenderer";
import { CanvasInteraction } from "../canvas/CanvasInteraction";

export const UI_EDITOR_VIEW_TYPE = "ui-editor-view";

/**
 * Main editor view for .uidesign files
 * Provides a canvas-based UI layout designer
 */
export class UIEditorView extends TextFileView {
  private state: EditorState;
  private canvas: HTMLCanvasElement | null = null;
  private renderer: CanvasRenderer | null = null;
  private interaction: CanvasInteraction | null = null;

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

    // Create canvas container (takes full remaining space)
    const canvasContainer = container.createDiv({
      cls: "ui-editor-canvas-container",
    });

    // Create canvas
    this.canvas = canvasContainer.createEl("canvas", {
      cls: "ui-editor-canvas",
    });

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
  }

  async onClose(): Promise<void> {
    this.renderer?.destroy();
    this.interaction?.destroy();
    this.canvas = null;
    this.renderer = null;
    this.interaction = null;
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
