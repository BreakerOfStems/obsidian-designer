import { Plugin, WorkspaceLeaf, Notice, TFile } from "obsidian";
import { UIEditorView, UI_EDITOR_VIEW_TYPE } from "./views/UIEditorView";
import { NodeTreeView, NODE_TREE_VIEW_TYPE } from "./views/NodeTreeView";
import { PropertiesView, PROPERTIES_VIEW_TYPE } from "./views/PropertiesView";
import { resetEditorState, getEditorState } from "./state/EditorState";
import { MarkdownGenerator } from "./utils/MarkdownGenerator";
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
      id: "generate-markdown",
      name: "Generate Markdown documentation",
      callback: () => this.generateMarkdown(),
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

    // Clipboard commands - use checkCallback for custom views
    this.addCommand({
      id: "copy-selection",
      name: "Copy selected components",
      hotkeys: [{ modifiers: ["Mod"], key: "c" }],
      checkCallback: (checking) => {
        const uiView = this.getActiveUIEditorView();
        if (!uiView) return false;

        const interaction = uiView.getInteraction();
        const hasSelection = getEditorState().getSelectedNodeIds().length > 0;

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
      hotkeys: [{ modifiers: ["Mod"], key: "x" }],
      checkCallback: (checking) => {
        const uiView = this.getActiveUIEditorView();
        if (!uiView) return false;

        const interaction = uiView.getInteraction();
        const hasSelection = getEditorState().getSelectedNodeIds().length > 0;

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
      hotkeys: [{ modifiers: ["Mod"], key: "v" }],
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
      hotkeys: [{ modifiers: ["Mod"], key: "d" }],
      checkCallback: (checking) => {
        const uiView = this.getActiveUIEditorView();
        if (!uiView) return false;

        const interaction = uiView.getInteraction();
        const hasSelection = getEditorState().getSelectedNodeIds().length > 0;

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
      hotkeys: [{ modifiers: ["Mod"], key: "z" }],
      checkCallback: (checking) => {
        const uiView = this.getActiveUIEditorView();
        if (!uiView) return false;

        const state = getEditorState();

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
      hotkeys: [
        { modifiers: ["Mod", "Shift"], key: "z" },
        { modifiers: ["Mod"], key: "y" },
      ],
      checkCallback: (checking) => {
        const uiView = this.getActiveUIEditorView();
        if (!uiView) return false;

        const state = getEditorState();

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
            this.ensurePanelsOpen();
          }
        })
      );
    });
  }

  onunload(): void {
    resetEditorState();
    this.app.workspace.detachLeavesOfType(UI_EDITOR_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(NODE_TREE_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(PROPERTIES_VIEW_TYPE);
  }

  private async generateMarkdown(): Promise<void> {
    const state = getEditorState();
    const doc = state.getDocument();
    const file = state.getFile();

    if (!doc || !file) {
      new Notice("No UI design document open");
      return;
    }

    // Generate markdown
    const markdown = MarkdownGenerator.generate(doc);

    // Create or update the corresponding .md file
    const mdPath = file.path.replace(/\.uidesign$/, ".md");

    const existingFile = this.app.vault.getAbstractFileByPath(mdPath);
    if (existingFile instanceof TFile) {
      await this.app.vault.modify(existingFile, markdown);
      new Notice(`Updated: ${mdPath}`);
    } else {
      await this.app.vault.create(mdPath, markdown);
      new Notice(`Created: ${mdPath}`);
    }
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
        "color.primary": "#2E6BE6",
        "color.secondary": "#6B7280",
        "color.background": "#FFFFFF",
        "color.surface": "#F3F4F6",
        "color.text": "#1F2937",
        "space.sm": 8,
        "space.md": 16,
        "space.lg": 24,
        "radius.sm": 4,
        "radius.md": 8,
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
