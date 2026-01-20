import { ItemView, WorkspaceLeaf } from "obsidian";
import { UINode, NodeStyle, NodeMeta, NodeContent, AbsoluteLayout, AnchoredLayout } from "../types/ui-schema";
import { EditorState, getEditorStateManager } from "../state/EditorState";

export const PROPERTIES_VIEW_TYPE = "ui-properties-view";

type StateEventCallback = (...args: unknown[]) => void;

/**
 * Right panel - Property editor for selected node
 */
export class PropertiesView extends ItemView {
  private state: EditorState | null = null;
  private contentContainer: HTMLElement | null = null;
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

    // Store handlers for cleanup
    this.stateEventHandlers.set("selection-changed", refreshHandler);
    this.stateEventHandlers.set("node-updated", refreshHandler);

    // Subscribe
    state.on("selection-changed", refreshHandler);
    state.on("node-updated", refreshHandler);

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
    return PROPERTIES_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Properties";
  }

  getIcon(): string {
    return "sliders-horizontal";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("ui-properties-container");

    // Header
    const header = container.createDiv({ cls: "ui-properties-header" });
    header.createSpan({ text: "Properties", cls: "ui-properties-title" });

    // Content
    this.contentContainer = container.createDiv({
      cls: "ui-properties-content",
    });

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

    this.contentContainer = null;
  }

  private refresh(): void {
    if (!this.contentContainer) return;
    this.contentContainer.empty();

    const state = this.state;
    if (!state) {
      this.contentContainer.createSpan({
        text: "No document loaded",
        cls: "ui-properties-empty",
      });
      return;
    }

    const selectedNode = state.getSelectedNode();

    if (!selectedNode) {
      this.contentContainer.createSpan({
        text: "No node selected",
        cls: "ui-properties-empty",
      });
      return;
    }

    // Node info section
    this.createSection("Node", this.contentContainer, (section) => {
      this.createTextField(section, "Name", selectedNode.name || "", (val) => {
        state.updateNode(selectedNode.id, { name: val });
      });

      this.createReadOnlyField(section, "Type", selectedNode.type);
      this.createReadOnlyField(section, "ID", selectedNode.id);
    });

    // Layout section
    this.createSection("Layout", this.contentContainer, (section) => {
      // Layout mode selector
      this.createSelectField(
        section,
        "Mode",
        selectedNode.layout.mode,
        [
          { value: "absolute", label: "Absolute" },
          { value: "anchored", label: "Anchored (Unity)" },
        ],
        (val) => {
          if (val === "absolute" && selectedNode.layout.mode !== "absolute") {
            // Convert to absolute layout
            state.updateNodeLayout(selectedNode.id, {
              mode: "absolute",
              x: 100,
              y: 100,
              w: 100,
              h: 100,
            });
          } else if (val === "anchored" && selectedNode.layout.mode !== "anchored") {
            // Convert to anchored layout
            state.updateNodeLayout(selectedNode.id, {
              mode: "anchored",
              anchorMin: [0.5, 0.5],
              anchorMax: [0.5, 0.5],
              pivot: [0.5, 0.5],
              anchoredPos: [0, 0],
              sizeDelta: [100, 100],
            });
          }
        }
      );

      if (selectedNode.layout.mode === "absolute") {
        const absLayout = selectedNode.layout as AbsoluteLayout;
        this.createNumberField(section, "X", absLayout.x, (val) => {
          state.updateNodeLayout(selectedNode.id, { ...absLayout, x: val });
        });

        this.createNumberField(section, "Y", absLayout.y, (val) => {
          state.updateNodeLayout(selectedNode.id, { ...absLayout, y: val });
        });

        this.createNumberField(section, "Width", absLayout.w, (val) => {
          state.updateNodeLayout(selectedNode.id, { ...absLayout, w: val });
        });

        this.createNumberField(section, "Height", absLayout.h, (val) => {
          state.updateNodeLayout(selectedNode.id, { ...absLayout, h: val });
        });
      } else if (selectedNode.layout.mode === "anchored") {
        const anchoredLayout = selectedNode.layout as AnchoredLayout;

        // Anchor Min
        this.createVector2Field(
          section,
          "Anchor Min",
          anchoredLayout.anchorMin,
          (val) => {
            state.updateNodeLayout(selectedNode.id, { ...anchoredLayout, anchorMin: val });
          },
          { min: 0, max: 1, step: 0.01 }
        );

        // Anchor Max
        this.createVector2Field(
          section,
          "Anchor Max",
          anchoredLayout.anchorMax,
          (val) => {
            state.updateNodeLayout(selectedNode.id, { ...anchoredLayout, anchorMax: val });
          },
          { min: 0, max: 1, step: 0.01 }
        );

        // Pivot
        this.createVector2Field(
          section,
          "Pivot",
          anchoredLayout.pivot,
          (val) => {
            state.updateNodeLayout(selectedNode.id, { ...anchoredLayout, pivot: val });
          },
          { min: 0, max: 1, step: 0.01 }
        );

        // Anchored Position
        this.createVector2Field(
          section,
          "Anchored Pos",
          anchoredLayout.anchoredPos,
          (val) => {
            state.updateNodeLayout(selectedNode.id, { ...anchoredLayout, anchoredPos: val });
          }
        );

        // Size Delta
        this.createVector2Field(
          section,
          "Size Delta",
          anchoredLayout.sizeDelta,
          (val) => {
            state.updateNodeLayout(selectedNode.id, { ...anchoredLayout, sizeDelta: val });
          }
        );
      }
    });

    // Style section
    this.createSection("Style", this.contentContainer, (section) => {
      const style = selectedNode.style || {};

      this.createColorField(
        section,
        "Background",
        style.background || "",
        (val) => {
          state.updateNodeStyle(selectedNode.id, { background: val });
        }
      );

      this.createColorField(
        section,
        "Text Color",
        style.textColor || "",
        (val) => {
          state.updateNodeStyle(selectedNode.id, { textColor: val });
        }
      );

      this.createColorField(
        section,
        "Border Color",
        style.borderColor || "",
        (val) => {
          state.updateNodeStyle(selectedNode.id, { borderColor: val });
        }
      );

      this.createNumberField(
        section,
        "Border Width",
        style.borderWidth || 0,
        (val) => {
          state.updateNodeStyle(selectedNode.id, { borderWidth: val });
        }
      );

      this.createNumberField(
        section,
        "Border Radius",
        style.borderRadius || 0,
        (val) => {
          state.updateNodeStyle(selectedNode.id, { borderRadius: val });
        }
      );

      this.createNumberField(
        section,
        "Opacity",
        style.opacity !== undefined ? style.opacity : 1,
        (val) => {
          state.updateNodeStyle(selectedNode.id, {
            opacity: Math.min(1, Math.max(0, val)),
          });
        }
      );
    });

    // Content section
    this.createSection("Content", this.contentContainer, (section) => {
      const content = selectedNode.content || {};

      this.createTextField(section, "Text", content.text || "", (val) => {
        state.updateNode(selectedNode.id, {
          content: { ...content, text: val },
        });
      });

      this.createTextField(section, "Icon", content.icon || "", (val) => {
        state.updateNode(selectedNode.id, {
          content: { ...content, icon: val },
        });
      });

      if (selectedNode.type === "Input") {
        this.createTextField(
          section,
          "Placeholder",
          content.placeholder || "",
          (val) => {
            state.updateNode(selectedNode.id, {
              content: { ...content, placeholder: val },
            });
          }
        );
      }

      if (selectedNode.type === "Image") {
        this.createTextField(section, "Source", content.src || "", (val) => {
          state.updateNode(selectedNode.id, {
            content: { ...content, src: val },
          });
        });
      }
    });

    // Meta section (critical per spec)
    this.createSection("Meta", this.contentContainer, (section) => {
      const meta = selectedNode.meta || {};

      this.createTextAreaField(section, "Purpose", meta.purpose || "", (val) => {
        state.updateNode(selectedNode.id, {
          meta: { ...meta, purpose: val },
        });
      });

      this.createTextAreaField(
        section,
        "Behavior",
        meta.behavior || "",
        (val) => {
          state.updateNode(selectedNode.id, {
            meta: { ...meta, behavior: val },
          });
        }
      );

      this.createTextField(
        section,
        "States",
        (meta.states || []).join(", "),
        (val) => {
          const states = val
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s);
          state.updateNode(selectedNode.id, {
            meta: { ...meta, states },
          });
        }
      );

      this.createTextAreaField(section, "Notes", meta.notes || "", (val) => {
        state.updateNode(selectedNode.id, {
          meta: { ...meta, notes: val },
        });
      });

      this.createTextField(
        section,
        "Related",
        (meta.related || []).join(", "),
        (val) => {
          const related = val
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s);
          state.updateNode(selectedNode.id, {
            meta: { ...meta, related },
          });
        }
      );
    });
  }

  private createSection(
    title: string,
    parent: HTMLElement,
    buildContent: (section: HTMLElement) => void
  ): void {
    const section = parent.createDiv({ cls: "ui-properties-section" });

    const header = section.createDiv({ cls: "ui-properties-section-header" });
    const toggle = header.createSpan({
      text: "▼",
      cls: "ui-properties-section-toggle",
    });
    header.createSpan({ text: title, cls: "ui-properties-section-title" });

    const content = section.createDiv({ cls: "ui-properties-section-content" });
    buildContent(content);

    header.addEventListener("click", () => {
      const isCollapsed = content.hasClass("is-collapsed");
      content.toggleClass("is-collapsed", !isCollapsed);
      toggle.textContent = isCollapsed ? "▼" : "▶";
    });
  }

  private createTextField(
    parent: HTMLElement,
    label: string,
    value: string,
    onChange: (value: string) => void
  ): void {
    const row = parent.createDiv({ cls: "ui-properties-row" });
    row.createSpan({ text: label, cls: "ui-properties-label" });

    const input = row.createEl("input", {
      type: "text",
      value: value,
      cls: "ui-properties-input",
    });

    input.addEventListener("change", () => {
      onChange(input.value);
    });
  }

  private createNumberField(
    parent: HTMLElement,
    label: string,
    value: number,
    onChange: (value: number) => void
  ): void {
    const row = parent.createDiv({ cls: "ui-properties-row" });
    row.createSpan({ text: label, cls: "ui-properties-label" });

    const input = row.createEl("input", {
      type: "number",
      value: String(value),
      cls: "ui-properties-input ui-properties-input-number",
    });

    input.addEventListener("change", () => {
      const num = parseFloat(input.value);
      if (!isNaN(num)) {
        onChange(num);
      }
    });
  }

  private createColorField(
    parent: HTMLElement,
    label: string,
    value: string,
    onChange: (value: string) => void
  ): void {
    const row = parent.createDiv({ cls: "ui-properties-row" });
    row.createSpan({ text: label, cls: "ui-properties-label" });

    const inputGroup = row.createDiv({ cls: "ui-properties-color-group" });

    // Color picker
    const colorInput = inputGroup.createEl("input", {
      type: "color",
      cls: "ui-properties-color-picker",
    });

    // Text input for token or hex value
    const textInput = inputGroup.createEl("input", {
      type: "text",
      value: value,
      cls: "ui-properties-input ui-properties-color-text",
      attr: { placeholder: "#000000 or token" },
    });

    // Set color picker value (only if it's a hex color)
    const hexMatch = value.match(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/);
    if (hexMatch) {
      colorInput.value = value;
    } else {
      colorInput.value = "#000000";
    }

    colorInput.addEventListener("input", () => {
      textInput.value = colorInput.value;
      onChange(colorInput.value);
    });

    textInput.addEventListener("change", () => {
      const val = textInput.value;
      // If it's a valid hex, update the color picker too
      if (/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(val)) {
        colorInput.value = val;
      }
      onChange(val);
    });
  }

  private createTextAreaField(
    parent: HTMLElement,
    label: string,
    value: string,
    onChange: (value: string) => void
  ): void {
    const row = parent.createDiv({ cls: "ui-properties-row ui-properties-row-vertical" });
    row.createSpan({ text: label, cls: "ui-properties-label" });

    const textarea = row.createEl("textarea", {
      cls: "ui-properties-textarea",
    });
    textarea.value = value;

    textarea.addEventListener("change", () => {
      onChange(textarea.value);
    });
  }

  private createReadOnlyField(
    parent: HTMLElement,
    label: string,
    value: string
  ): void {
    const row = parent.createDiv({ cls: "ui-properties-row" });
    row.createSpan({ text: label, cls: "ui-properties-label" });
    row.createSpan({ text: value, cls: "ui-properties-value-readonly" });
  }

  private createSelectField(
    parent: HTMLElement,
    label: string,
    value: string,
    options: { value: string; label: string }[],
    onChange: (value: string) => void
  ): void {
    const row = parent.createDiv({ cls: "ui-properties-row" });
    row.createSpan({ text: label, cls: "ui-properties-label" });

    const select = row.createEl("select", {
      cls: "ui-properties-select",
    });

    for (const option of options) {
      const optEl = select.createEl("option", {
        value: option.value,
        text: option.label,
      });
      if (option.value === value) {
        optEl.selected = true;
      }
    }

    select.addEventListener("change", () => {
      onChange(select.value);
    });
  }

  private createVector2Field(
    parent: HTMLElement,
    label: string,
    value: [number, number],
    onChange: (value: [number, number]) => void,
    options?: { min?: number; max?: number; step?: number }
  ): void {
    const row = parent.createDiv({ cls: "ui-properties-row" });
    row.createSpan({ text: label, cls: "ui-properties-label" });

    const inputGroup = row.createDiv({ cls: "ui-properties-vector2-group" });

    const inputX = inputGroup.createEl("input", {
      type: "number",
      value: String(value[0]),
      cls: "ui-properties-input ui-properties-input-vector2",
      attr: {
        placeholder: "X",
        ...(options?.min !== undefined && { min: String(options.min) }),
        ...(options?.max !== undefined && { max: String(options.max) }),
        ...(options?.step !== undefined && { step: String(options.step) }),
      },
    });

    const inputY = inputGroup.createEl("input", {
      type: "number",
      value: String(value[1]),
      cls: "ui-properties-input ui-properties-input-vector2",
      attr: {
        placeholder: "Y",
        ...(options?.min !== undefined && { min: String(options.min) }),
        ...(options?.max !== undefined && { max: String(options.max) }),
        ...(options?.step !== undefined && { step: String(options.step) }),
      },
    });

    const handleChange = () => {
      const x = parseFloat(inputX.value);
      const y = parseFloat(inputY.value);
      if (!isNaN(x) && !isNaN(y)) {
        onChange([x, y]);
      }
    };

    inputX.addEventListener("change", handleChange);
    inputY.addEventListener("change", handleChange);
  }
}
