import { TextFileView, WorkspaceLeaf, Menu, Notice } from "obsidian";
import { UIDocument, NodeType } from "../types/ui-schema";
import { EditorState, getEditorStateManager } from "../state/EditorState";
import { CanvasRenderer } from "../canvas/CanvasRenderer";
import { CanvasInteraction } from "../canvas/CanvasInteraction";
import {
  migrateDocument,
  needsMigration,
  getDocumentVersion,
  CURRENT_SCHEMA_VERSION,
} from "../migrations";

export const UI_EDITOR_VIEW_TYPE = "ui-editor-view";

/**
 * Main editor view for .uidesign files
 * Provides a canvas-based UI layout designer
 */
export class UIEditorView extends TextFileView {
  private state: EditorState | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private renderer: CanvasRenderer | null = null;
  private interaction: CanvasInteraction | null = null;
  private dirtyHandler: ((isDirty: unknown) => void) | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    // State will be initialized in setViewData when we know the file
  }

  /**
   * Get the state for this view (creates one tied to the file path)
   */
  private ensureState(): EditorState {
    if (!this.state && this.file) {
      this.state = getEditorStateManager().getStateForFile(this.file.path);
    }
    if (!this.state) {
      // Fallback: create a temporary state if file isn't set yet
      this.state = getEditorStateManager().getStateForFile("__temp__");
    }
    return this.state;
  }

  /**
   * Get the EditorState for external access (e.g., clipboard commands)
   */
  getEditorState(): EditorState {
    return this.ensureState();
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

    // Note: renderer and interaction will be initialized in setViewData
    // when we have the file and state ready
  }

  /**
   * Initialize or reinitialize renderer and interaction with current state
   */
  private initializeCanvas(): void {
    if (!this.canvas) return;

    // Clean up existing renderer/interaction
    this.renderer?.destroy();
    this.interaction?.destroy();

    // Remove old dirty handler if exists
    if (this.dirtyHandler && this.state) {
      this.state.off("dirty-changed", this.dirtyHandler);
    }

    const state = this.ensureState();

    // Initialize renderer and interaction with the file-specific state
    this.renderer = new CanvasRenderer(this.canvas, state);
    this.interaction = new CanvasInteraction(
      this.canvas,
      state,
      this.renderer
    );

    // Listen for state changes
    this.dirtyHandler = (isDirty: unknown) => {
      if (isDirty) {
        this.requestSave();
      }
    };
    state.on("dirty-changed", this.dirtyHandler);
  }

  async onClose(): Promise<void> {
    // Remove dirty handler
    if (this.dirtyHandler && this.state) {
      this.state.off("dirty-changed", this.dirtyHandler);
      this.dirtyHandler = null;
    }

    this.renderer?.destroy();
    this.interaction?.destroy();
    this.canvas = null;
    this.renderer = null;
    this.interaction = null;
    this.state = null;
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
      this.ensureState().setViewport({ panX: 50, panY: 50, zoom: 1 });
    });

    const zoomInBtn = viewGroup.createEl("button", {
      cls: "ui-editor-toolbar-btn",
      attr: { title: "Zoom In" },
    });
    zoomInBtn.textContent = "+";
    zoomInBtn.addEventListener("click", () => {
      const state = this.ensureState();
      const viewport = state.getViewport();
      state.setViewport({ zoom: Math.min(viewport.zoom * 1.2, 5) });
    });

    const zoomOutBtn = viewGroup.createEl("button", {
      cls: "ui-editor-toolbar-btn",
      attr: { title: "Zoom Out" },
    });
    zoomOutBtn.textContent = "-";
    zoomOutBtn.addEventListener("click", () => {
      const state = this.ensureState();
      const viewport = state.getViewport();
      state.setViewport({ zoom: Math.max(viewport.zoom / 1.2, 0.1) });
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
    return this.ensureState().serialize();
  }

  setViewData(data: string, clear: boolean): void {
    if (clear) {
      this.clear();
    }

    // Get state for this specific file
    const state = this.ensureState();

    // Set this file as active in the state manager
    if (this.file) {
      getEditorStateManager().setActiveFile(this.file.path);
    }

    try {
      let doc: UIDocument;

      if (!data || data.trim() === "") {
        doc = state.createNewDocument(this.file?.basename);
      } else {
        const parsed = JSON.parse(data);

        // Check if migration is needed and apply it
        if (needsMigration(parsed)) {
          const originalVersion = getDocumentVersion(parsed);
          const result = migrateDocument(parsed);

          if (result.success) {
            doc = result.document;
            // Notify user about automatic migration
            if (result.migrationsApplied.length > 0) {
              new Notice(
                `UI Design upgraded from v${originalVersion} to v${CURRENT_SCHEMA_VERSION}`,
                5000
              );
              console.log(
                "UI Design migration applied:",
                result.migrationsApplied
              );
            }
          } else {
            // Migration failed - log errors but try to load document anyway
            console.error("UI Design migration errors:", result.errors);
            new Notice(
              `Warning: Schema migration had errors. See console for details.`,
              5000
            );
            doc = result.document;
          }
        } else {
          doc = parsed as UIDocument;
        }

        // Ensure required fields exist (backwards compatibility)
        if (!doc.tokens) doc.tokens = {};
        if (!doc.components) doc.components = {};
        if (!doc.screens) doc.screens = {};

        // Ensure schemaVersion is set
        if (!doc.schemaVersion) {
          doc.schemaVersion = CURRENT_SCHEMA_VERSION;
        }

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

      state.loadDocument(doc, this.file!);
      state.setViewport({ panX: 50, panY: 50, zoom: 1 });

      // Initialize canvas with the proper state
      this.initializeCanvas();
    } catch (e) {
      console.error("Failed to parse UI document:", e);
      const doc = state.createNewDocument(this.file?.basename);
      state.loadDocument(doc, this.file!);
      this.initializeCanvas();
    }
  }

  clear(): void {
    this.ensureState().clearSelection();
  }

  onPaneMenu(menu: Menu, source: string): void {
    super.onPaneMenu(menu, source);

    menu.addItem((item) => {
      item
        .setTitle("Reset View")
        .setIcon("refresh-cw")
        .onClick(() => {
          this.ensureState().setViewport({ panX: 50, panY: 50, zoom: 1 });
        });
    });
  }

  /**
   * Get the canvas interaction handler for clipboard operations
   */
  getInteraction(): CanvasInteraction | null {
    return this.interaction;
  }
}
