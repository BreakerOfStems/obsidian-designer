import { Plugin, WorkspaceLeaf } from "obsidian";
import { UIEditorView, UI_EDITOR_VIEW_TYPE } from "./views/UIEditorView";
import { NodeTreeView, NODE_TREE_VIEW_TYPE } from "./views/NodeTreeView";
import { PropertiesView, PROPERTIES_VIEW_TYPE } from "./views/PropertiesView";
import { TokenBrowserView, TOKEN_BROWSER_VIEW_TYPE } from "./views/TokenBrowserView";
import { getEditorStateManager, resetEditorStateManager } from "./state/EditorState";
import { UIDocument } from "./types/ui-schema";

export default class UIDesignerPlugin extends Plugin {
  async onload(): Promise<void> {
    // Register views
    this.registerView(
      UI_EDITOR_VIEW_TYPE,
      (leaf) => new UIEditorView(leaf)
    );

    this.registerView(
      NODE_TREE_VIEW_TYPE,
      (leaf) => new NodeTreeView(leaf)
    );

    this.registerView(
      PROPERTIES_VIEW_TYPE,
      (leaf) => new PropertiesView(leaf)
    );

    this.registerView(
      TOKEN_BROWSER_VIEW_TYPE,
      (leaf) => new TokenBrowserView(leaf)
    );

    // Register .uidesign file extension
    this.registerExtensions(["uidesign"], UI_EDITOR_VIEW_TYPE);

    // Add ribbon icon to create new UI file
    this.addRibbonIcon("layout", "Create UI Design", () => {
      this.createNewUIFile().catch((e) => {
        console.error("UI Designer: Failed to create file", e);
      });
    });

    // Add commands
    this.addCommand({
      id: "create-ui-file",
      name: "Create new UI design file",
      callback: () => this.createNewUIFile(),
    });

    this.addCommand({
      id: "open-node-tree",
      name: "Open node tree panel",
      callback: () => this.activateView(NODE_TREE_VIEW_TYPE, "left"),
    });

    this.addCommand({
      id: "open-properties",
      name: "Open properties panel",
      callback: () => this.activateView(PROPERTIES_VIEW_TYPE, "right"),
    });

    this.addCommand({
      id: "open-token-browser",
      name: "Open token browser panel",
      callback: () => this.activateView(TOKEN_BROWSER_VIEW_TYPE, "right"),
    });

    // Clipboard commands - use checkCallback for custom views
    // Note: Hotkeys are handled by canvas-level keyboard handler in CanvasInteraction.ts
    // to avoid conflicts with Obsidian's built-in clipboard commands
    this.addCommand({
      id: "copy-selection",
      name: "Copy selected components",
      checkCallback: (checking) => {
        const uiView = this.getActiveUIEditorView();
        if (!uiView) return false;

        const interaction = uiView.getInteraction();
        const state = uiView.getEditorState();
        const hasSelection = state.getSelectedNodeIds().length > 0;

        if (checking) {
          return hasSelection;
        }

        if (interaction && hasSelection) {
          interaction.copySelection();
        }
        return true;
      },
    });

    this.addCommand({
      id: "cut-selection",
      name: "Cut selected components",
      checkCallback: (checking) => {
        const uiView = this.getActiveUIEditorView();
        if (!uiView) return false;

        const interaction = uiView.getInteraction();
        const state = uiView.getEditorState();
        const hasSelection = state.getSelectedNodeIds().length > 0;

        if (checking) {
          return hasSelection;
        }

        if (interaction && hasSelection) {
          interaction.cutSelection();
        }
        return true;
      },
    });

    this.addCommand({
      id: "paste-components",
      name: "Paste components",
      checkCallback: (checking) => {
        const uiView = this.getActiveUIEditorView();
        if (!uiView) return false;

        const interaction = uiView.getInteraction();

        if (checking) {
          return interaction?.hasClipboardContent() ?? false;
        }

        if (interaction) {
          interaction.pasteAtCursor();
        }
        return true;
      },
    });

    this.addCommand({
      id: "duplicate-selection",
      name: "Duplicate selected components",
      checkCallback: (checking) => {
        const uiView = this.getActiveUIEditorView();
        if (!uiView) return false;

        const interaction = uiView.getInteraction();
        const state = uiView.getEditorState();
        const hasSelection = state.getSelectedNodeIds().length > 0;

        if (checking) {
          return hasSelection;
        }

        if (interaction && hasSelection) {
          interaction.duplicateSelection();
        }
        return true;
      },
    });

    // Undo/Redo commands
    this.addCommand({
      id: "undo",
      name: "Undo",
      checkCallback: (checking) => {
        const uiView = this.getActiveUIEditorView();
        if (!uiView) return false;

        const state = uiView.getEditorState();

        if (checking) {
          return state.canUndo();
        }

        state.undo();
        return true;
      },
    });

    this.addCommand({
      id: "redo",
      name: "Redo",
      checkCallback: (checking) => {
        const uiView = this.getActiveUIEditorView();
        if (!uiView) return false;

        const state = uiView.getEditorState();

        if (checking) {
          return state.canRedo();
        }

        state.redo();
        return true;
      },
    });

    // When layout is ready, restore side panels if they were open
    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(
        this.app.workspace.on("active-leaf-change", (leaf) => {
          if (leaf?.view.getViewType() === UI_EDITOR_VIEW_TYPE) {
            const uiView = leaf.view as UIEditorView;
            // Set the active file in the state manager so sidebar views update
            if (uiView.file) {
              getEditorStateManager().setActiveFile(uiView.file.path);
            }
            this.ensurePanelsOpen();
          } else {
            // If switching to a non-UI editor view, clear the active file
            // so sidebar views show "No document loaded"
            // Note: We only do this if there are no other UI editor views active
            const hasActiveUIEditor = this.app.workspace.getLeavesOfType(UI_EDITOR_VIEW_TYPE)
              .some(l => l === this.app.workspace.getLeaf());
            if (!hasActiveUIEditor) {
              getEditorStateManager().setActiveFile(null);
            }
          }
        })
      );
    });
  }

  onunload(): void {
    resetEditorStateManager();
    this.app.workspace.detachLeavesOfType(UI_EDITOR_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(NODE_TREE_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(PROPERTIES_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(TOKEN_BROWSER_VIEW_TYPE);
  }

  private async createNewUIFile(): Promise<void> {
    let filename = "design.uidesign";
    let counter = 1;
    const activeFile = this.app.workspace.getActiveFile();
    const folder = activeFile?.parent?.path || "";

    while (
      this.app.vault.getAbstractFileByPath(
        folder ? `${folder}/${filename}` : filename
      )
    ) {
      filename = `design-${counter}.uidesign`;
      counter++;
    }

    const path = folder ? `${folder}/${filename}` : filename;

    const emptyDoc: UIDocument = {
      version: "1.0",
      name: "Untitled Design",
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
        // Spacing tokens
        "space.xs": 4,
        "space.sm": 8,
        "space.md": 16,
        "space.lg": 24,
        "space.xl": 32,
        // Radius tokens
        "radius.none": 0,
        "radius.sm": 4,
        "radius.md": 8,
        "radius.lg": 12,
        "radius.full": 9999,
        // Typography tokens
        "type.font.body": "Inter, system-ui, sans-serif",
        "type.font.heading": "Inter, system-ui, sans-serif",
        "type.size.sm": 14,
        "type.size.md": 16,
        "type.size.lg": 18,
        "type.size.xl": 24,
        "type.weight.normal": 400,
        "type.weight.medium": 500,
        "type.weight.bold": 700,
        "type.lineHeight.normal": 1.5,
        // Elevation tokens
        "elevation.none": "none",
        "elevation.sm": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        "elevation.md": "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        "elevation.lg": "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
      },
      components: {},
      screens: {
        main: {
          id: "main",
          name: "Main Screen",
          root: {
            id: "root",
            type: "Container",
            name: "Root",
            layout: {
              mode: "absolute",
              x: 0,
              y: 0,
              w: 375,
              h: 667,
            },
            style: {
              background: "color.background",
            },
            children: [],
          },
        },
      },
    };

    const file = await this.app.vault.create(
      path,
      JSON.stringify(emptyDoc, null, 2)
    );

    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
  }

  private async activateView(
    viewType: string,
    side: "left" | "right"
  ): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(viewType)[0] || null;

    if (!leaf) {
      leaf =
        side === "left"
          ? workspace.getLeftLeaf(false)
          : workspace.getRightLeaf(false);

      if (leaf) {
        await leaf.setViewState({ type: viewType, active: true });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  private async ensurePanelsOpen(): Promise<void> {
    const { workspace } = this.app;

    if (workspace.getLeavesOfType(NODE_TREE_VIEW_TYPE).length === 0) {
      const leftLeaf = workspace.getLeftLeaf(false);
      if (leftLeaf) {
        await leftLeaf.setViewState({ type: NODE_TREE_VIEW_TYPE, active: true });
      }
    }
  }

  /**
   * Get the active UI Editor view if one is open
   */
  private getActiveUIEditorView(): UIEditorView | null {
    const activeView = this.app.workspace.getActiveViewOfType(UIEditorView);
    return activeView;
  }
}
