import { ItemView, WorkspaceLeaf } from "obsidian";
import {
  UINode,
  NodeStyle,
  NodeMeta,
  NodeContent,
  NodeBehavior,
  NodeBinding,
  BehaviorEvent,
  BehaviorEventType,
  BindValidation,
  BindValidationType,
  BindFormat,
  AbsoluteLayout,
  AnchoredLayout,
  DesignTokens,
  getTokensByCategory,
  ElementRole,
  ELEMENT_ROLES,
  BEHAVIOR_EVENT_TYPES,
  BIND_FORMATS,
  BIND_VALIDATION_TYPES,
  getDefaultMeta,
  getDefaultBehavior,
  getDefaultBinding,
  A11yMeta,
} from "../types/ui-schema";
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

    // Get tokens for dropdowns
    const doc = state.getDocument();
    const tokens = doc?.tokens || {};

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

      this.createTokenOrNumberField(
        section,
        "Border Width",
        style.borderWidth,
        tokens,
        "space",
        (val) => {
          state.updateNodeStyle(selectedNode.id, { borderWidth: val });
        }
      );

      this.createTokenOrNumberField(
        section,
        "Border Radius",
        style.borderRadius,
        tokens,
        "radius",
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

      this.createTokenField(
        section,
        "Shadow",
        style.shadow || "",
        tokens,
        "elevation",
        (val) => {
          state.updateNodeStyle(selectedNode.id, { shadow: val });
        }
      );

      this.createTokenOrNumberField(
        section,
        "Padding",
        style.padding,
        tokens,
        "space",
        (val) => {
          state.updateNodeStyle(selectedNode.id, { padding: val });
        }
      );
    });

    // Typography section
    this.createSection("Typography", this.contentContainer, (section) => {
      const style = selectedNode.style || {};

      this.createTokenField(
        section,
        "Font Family",
        String(style.fontFamily || ""),
        tokens,
        "type.font",
        (val) => {
          state.updateNodeStyle(selectedNode.id, { fontFamily: val });
        }
      );

      this.createTokenOrNumberField(
        section,
        "Font Size",
        style.fontSize,
        tokens,
        "type.size",
        (val) => {
          state.updateNodeStyle(selectedNode.id, { fontSize: val });
        }
      );

      this.createTokenOrNumberField(
        section,
        "Font Weight",
        style.fontWeight,
        tokens,
        "type.weight",
        (val) => {
          state.updateNodeStyle(selectedNode.id, { fontWeight: val });
        }
      );

      this.createTokenOrNumberField(
        section,
        "Line Height",
        style.lineHeight,
        tokens,
        "type.lineHeight",
        (val) => {
          state.updateNodeStyle(selectedNode.id, { lineHeight: val });
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

    // Behavior section - runtime interactions and events
    this.createSection("Behavior", this.contentContainer, (section) => {
      const behavior = selectedNode.behavior || {};

      // Enabled toggle
      this.createSelectField(
        section,
        "Enabled",
        behavior.enabled === false ? "false" : "true",
        [
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ],
        (val) => {
          state.updateNodeBehavior(selectedNode.id, {
            ...behavior,
            enabled: val === "true",
          });
        }
      );

      // Interaction mode (for containers)
      if (["Container", "Card", "Modal", "List"].includes(selectedNode.type)) {
        this.createSelectField(
          section,
          "Interaction",
          behavior.interactionMode || "passthrough",
          [
            { value: "none", label: "None" },
            { value: "passthrough", label: "Passthrough" },
            { value: "block", label: "Block" },
          ],
          (val) => {
            state.updateNodeBehavior(selectedNode.id, {
              ...behavior,
              interactionMode: val as "none" | "passthrough" | "block",
            });
          }
        );
      }

      // Events list
      const events = behavior.events || [];
      this.createEventsListField(section, events, (newEvents) => {
        state.updateNodeBehavior(selectedNode.id, {
          ...behavior,
          events: newEvents,
        });
      });

      // Reset to default behavior
      this.createButtonField(
        section,
        "Reset to defaults",
        () => {
          const defaultBehavior = getDefaultBehavior(selectedNode.type);
          state.updateNodeBehavior(selectedNode.id, defaultBehavior || {});
        }
      );
    });

    // Binding section - data contract and field mapping
    this.createSection("Binding", this.contentContainer, (section) => {
      const bind = selectedNode.bind || {};

      // Data path
      this.createTextField(
        section,
        "Path",
        bind.path || "",
        (val) => {
          state.updateNodeBinding(selectedNode.id, {
            ...bind,
            path: val || undefined,
          });
        }
      );

      // Format
      this.createSelectField(
        section,
        "Format",
        bind.format || "text",
        BIND_FORMATS.map(f => ({ value: f.value, label: f.label })),
        (val) => {
          state.updateNodeBinding(selectedNode.id, {
            ...bind,
            format: val as BindFormat,
          });
        }
      );

      // Format string (for custom formats)
      if (bind.format === "custom" || bind.format === "date" || bind.format === "datetime" || bind.format === "currency") {
        this.createTextField(
          section,
          "Format String",
          bind.formatString || "",
          (val) => {
            state.updateNodeBinding(selectedNode.id, {
              ...bind,
              formatString: val || undefined,
            });
          }
        );
      }

      // Direction
      this.createSelectField(
        section,
        "Direction",
        bind.direction || "read",
        [
          { value: "read", label: "Read Only" },
          { value: "write", label: "Write Only" },
          { value: "two-way", label: "Two-Way" },
        ],
        (val) => {
          state.updateNodeBinding(selectedNode.id, {
            ...bind,
            direction: val as "read" | "write" | "two-way",
          });
        }
      );

      // Default value
      this.createTextField(
        section,
        "Default",
        bind.defaultValue !== undefined ? String(bind.defaultValue) : "",
        (val) => {
          state.updateNodeBinding(selectedNode.id, {
            ...bind,
            defaultValue: val || undefined,
          });
        }
      );

      // Transform function name
      this.createTextField(
        section,
        "Transform",
        bind.transform || "",
        (val) => {
          state.updateNodeBinding(selectedNode.id, {
            ...bind,
            transform: val || undefined,
          });
        }
      );

      // Validation rules
      const validation = bind.validation || [];
      this.createValidationListField(section, validation, (newValidation) => {
        state.updateNodeBinding(selectedNode.id, {
          ...bind,
          validation: newValidation.length > 0 ? newValidation : undefined,
        });
      });

      // Reset to default binding
      this.createButtonField(
        section,
        "Reset to defaults",
        () => {
          const defaultBinding = getDefaultBinding(selectedNode.type);
          state.updateNodeBinding(selectedNode.id, defaultBinding || {});
        }
      );
    });

    // Meta section (critical per spec)
    this.createSection("Meta", this.contentContainer, (section) => {
      const meta = selectedNode.meta || {};

      // Role dropdown
      this.createSelectField(
        section,
        "Role",
        meta.role || "custom",
        ELEMENT_ROLES.map(r => ({ value: r.value, label: r.label })),
        (val) => {
          state.updateNode(selectedNode.id, {
            meta: { ...meta, role: val as ElementRole, autofilled: false },
          }, "Set element role");
        }
      );

      // Template info (read-only)
      if (meta.templateVersion) {
        this.createReadOnlyField(section, "Template Ver", meta.templateVersion);
      }
      this.createReadOnlyField(
        section,
        "Auto-filled",
        meta.autofilled ? "Yes" : "No"
      );

      // Reset to template button
      this.createButtonField(
        section,
        "Reset to default template",
        () => {
          const defaultMeta = getDefaultMeta(selectedNode.type);
          state.updateNode(selectedNode.id, {
            meta: defaultMeta,
          }, "Reset meta to template defaults");
        }
      );

      this.createTextAreaField(section, "Purpose", meta.purpose || "", (val) => {
        state.updateNode(selectedNode.id, {
          meta: { ...meta, purpose: val, autofilled: false },
        }, "Set element purpose");
      });

      this.createTextAreaField(
        section,
        "Behavior",
        meta.behavior || "",
        (val) => {
          state.updateNode(selectedNode.id, {
            meta: { ...meta, behavior: val, autofilled: false },
          }, "Set element behavior");
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
            meta: { ...meta, states, autofilled: false },
          }, "Set element states");
        }
      );

      this.createTextAreaField(section, "Notes", meta.notes || "", (val) => {
        state.updateNode(selectedNode.id, {
          meta: { ...meta, notes: val },
        }, "Set element notes");
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
          }, "Set related elements");
        }
      );
    });

    // Accessibility section
    this.createSection("Accessibility", this.contentContainer, (section) => {
      const meta = selectedNode.meta || {};
      const a11y = meta.a11y || {};

      this.createTextField(
        section,
        "Label",
        a11y.label || "",
        (val) => {
          state.updateNode(selectedNode.id, {
            meta: { ...meta, a11y: { ...a11y, label: val }, autofilled: false },
          }, "Set accessibility label");
        }
      );

      this.createTextField(
        section,
        "Hint",
        a11y.hint || "",
        (val) => {
          state.updateNode(selectedNode.id, {
            meta: { ...meta, a11y: { ...a11y, hint: val }, autofilled: false },
          }, "Set accessibility hint");
        }
      );

      this.createTextField(
        section,
        "ARIA Role",
        a11y.role || "",
        (val) => {
          state.updateNode(selectedNode.id, {
            meta: { ...meta, a11y: { ...a11y, role: val || undefined }, autofilled: false },
          }, "Set ARIA role");
        }
      );

      this.createSelectField(
        section,
        "Live Region",
        a11y.live || "off",
        [
          { value: "off", label: "Off" },
          { value: "polite", label: "Polite" },
          { value: "assertive", label: "Assertive" },
        ],
        (val) => {
          const liveValue = val === "off" ? undefined : val as "polite" | "assertive";
          state.updateNode(selectedNode.id, {
            meta: { ...meta, a11y: { ...a11y, live: liveValue }, autofilled: false },
          }, "Set live region");
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

  private createButtonField(
    parent: HTMLElement,
    label: string,
    onClick: () => void
  ): void {
    const row = parent.createDiv({ cls: "ui-properties-row ui-properties-row-button" });
    const button = row.createEl("button", {
      text: label,
      cls: "ui-properties-button",
    });
    button.addEventListener("click", onClick);
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

  /**
   * Create a field that allows selecting from token values or entering a custom string
   */
  private createTokenField(
    parent: HTMLElement,
    label: string,
    value: string,
    tokens: DesignTokens,
    tokenCategory: string,
    onChange: (value: string) => void
  ): void {
    const row = parent.createDiv({ cls: "ui-properties-row" });
    row.createSpan({ text: label, cls: "ui-properties-label" });

    const inputGroup = row.createDiv({ cls: "ui-properties-token-group" });

    // Get tokens for this category
    const categoryTokens = getTokensByCategory(tokens, tokenCategory);
    const tokenKeys = Object.keys(categoryTokens);

    // Dropdown for token selection
    const select = inputGroup.createEl("select", {
      cls: "ui-properties-select ui-properties-token-select",
    });

    // Add "Custom" option
    select.createEl("option", { value: "", text: "Custom" });

    // Add token options
    for (const key of tokenKeys) {
      const tokenValue = categoryTokens[key];
      const displayValue = typeof tokenValue === "string"
        ? (tokenValue.length > 20 ? tokenValue.substring(0, 20) + "..." : tokenValue)
        : tokenValue;
      const optEl = select.createEl("option", {
        value: key,
        text: `${key.split(".").pop()} (${displayValue})`,
      });
      if (key === value) {
        optEl.selected = true;
      }
    }

    // Text input for custom value
    const textInput = inputGroup.createEl("input", {
      type: "text",
      value: value,
      cls: "ui-properties-input ui-properties-token-text",
      attr: { placeholder: "Token or value" },
    });

    // If value matches a token, select it
    if (tokenKeys.includes(value)) {
      select.value = value;
    }

    select.addEventListener("change", () => {
      if (select.value) {
        textInput.value = select.value;
        onChange(select.value);
      }
    });

    textInput.addEventListener("change", () => {
      // Update select if it matches a token
      if (tokenKeys.includes(textInput.value)) {
        select.value = textInput.value;
      } else {
        select.value = "";
      }
      onChange(textInput.value);
    });
  }

  /**
   * Create a field that allows selecting from token values or entering a number
   */
  private createTokenOrNumberField(
    parent: HTMLElement,
    label: string,
    value: string | number | undefined,
    tokens: DesignTokens,
    tokenCategory: string,
    onChange: (value: string | number) => void
  ): void {
    const row = parent.createDiv({ cls: "ui-properties-row" });
    row.createSpan({ text: label, cls: "ui-properties-label" });

    const inputGroup = row.createDiv({ cls: "ui-properties-token-group" });

    // Get tokens for this category
    const categoryTokens = getTokensByCategory(tokens, tokenCategory);
    const tokenKeys = Object.keys(categoryTokens);

    // Dropdown for token selection
    const select = inputGroup.createEl("select", {
      cls: "ui-properties-select ui-properties-token-select",
    });

    // Add "Custom" option
    select.createEl("option", { value: "__custom__", text: "Custom" });

    // Add token options
    for (const key of tokenKeys) {
      const tokenValue = categoryTokens[key];
      const optEl = select.createEl("option", {
        value: key,
        text: `${key.split(".").pop()} (${tokenValue})`,
      });
      if (key === value) {
        optEl.selected = true;
      }
    }

    // Number input for custom value
    const numInput = inputGroup.createEl("input", {
      type: "text",
      value: value !== undefined ? String(value) : "",
      cls: "ui-properties-input ui-properties-token-number",
      attr: { placeholder: "Token or number" },
    });

    // If value matches a token, select it
    if (typeof value === "string" && tokenKeys.includes(value)) {
      select.value = value;
    } else {
      select.value = "__custom__";
    }

    select.addEventListener("change", () => {
      if (select.value !== "__custom__") {
        numInput.value = select.value;
        onChange(select.value);
      }
    });

    numInput.addEventListener("change", () => {
      const val = numInput.value;
      // Check if it's a token reference
      if (tokenKeys.includes(val)) {
        select.value = val;
        onChange(val);
      } else {
        // Try to parse as number
        const num = parseFloat(val);
        select.value = "__custom__";
        if (!isNaN(num)) {
          onChange(num);
        } else if (val) {
          // Keep as string (might be a token reference user typed)
          onChange(val);
        }
      }
    });
  }

  /**
   * Create a list field for editing behavior events
   */
  private createEventsListField(
    parent: HTMLElement,
    events: BehaviorEvent[],
    onChange: (events: BehaviorEvent[]) => void
  ): void {
    const container = parent.createDiv({ cls: "ui-properties-list-container" });
    container.createSpan({ text: "Events", cls: "ui-properties-label ui-properties-list-label" });

    const listEl = container.createDiv({ cls: "ui-properties-list" });

    // Render existing events
    events.forEach((event, index) => {
      const itemEl = listEl.createDiv({ cls: "ui-properties-list-item" });

      // Event type dropdown
      const typeSelect = itemEl.createEl("select", {
        cls: "ui-properties-select ui-properties-list-select",
      });
      for (const eventType of BEHAVIOR_EVENT_TYPES) {
        const opt = typeSelect.createEl("option", {
          value: eventType.value,
          text: eventType.label,
        });
        if (eventType.value === event.type) {
          opt.selected = true;
        }
      }

      // Event name input
      const nameInput = itemEl.createEl("input", {
        type: "text",
        value: event.name,
        cls: "ui-properties-input ui-properties-list-input",
        attr: { placeholder: "Handler name" },
      });

      // Payload hint input (smaller)
      const hintInput = itemEl.createEl("input", {
        type: "text",
        value: event.payloadHint || "",
        cls: "ui-properties-input ui-properties-list-input-small",
        attr: { placeholder: "Payload hint" },
      });

      // Remove button
      const removeBtn = itemEl.createEl("button", {
        text: "×",
        cls: "ui-properties-list-remove",
      });

      typeSelect.addEventListener("change", () => {
        const newEvents = [...events];
        newEvents[index] = { ...newEvents[index], type: typeSelect.value as BehaviorEventType };
        onChange(newEvents);
      });

      nameInput.addEventListener("change", () => {
        const newEvents = [...events];
        newEvents[index] = { ...newEvents[index], name: nameInput.value };
        onChange(newEvents);
      });

      hintInput.addEventListener("change", () => {
        const newEvents = [...events];
        newEvents[index] = {
          ...newEvents[index],
          payloadHint: hintInput.value || undefined,
        };
        onChange(newEvents);
      });

      removeBtn.addEventListener("click", () => {
        const newEvents = events.filter((_, i) => i !== index);
        onChange(newEvents);
      });
    });

    // Add event button
    const addBtn = container.createEl("button", {
      text: "+ Add Event",
      cls: "ui-properties-list-add",
    });
    addBtn.addEventListener("click", () => {
      const newEvents = [...events, { type: "click" as BehaviorEventType, name: "onClick" }];
      onChange(newEvents);
    });
  }

  /**
   * Create a list field for editing validation rules
   */
  private createValidationListField(
    parent: HTMLElement,
    validation: BindValidation[],
    onChange: (validation: BindValidation[]) => void
  ): void {
    const container = parent.createDiv({ cls: "ui-properties-list-container" });
    container.createSpan({ text: "Validation", cls: "ui-properties-label ui-properties-list-label" });

    const listEl = container.createDiv({ cls: "ui-properties-list" });

    // Render existing validation rules
    validation.forEach((rule, index) => {
      const itemEl = listEl.createDiv({ cls: "ui-properties-list-item" });

      // Validation type dropdown
      const typeSelect = itemEl.createEl("select", {
        cls: "ui-properties-select ui-properties-list-select",
      });
      for (const valType of BIND_VALIDATION_TYPES) {
        const opt = typeSelect.createEl("option", {
          value: valType.value,
          text: valType.label,
        });
        if (valType.value === rule.type) {
          opt.selected = true;
        }
      }

      // Value input (for rules that need a value like minLength, pattern)
      const valueInput = itemEl.createEl("input", {
        type: "text",
        value: rule.value !== undefined ? String(rule.value) : "",
        cls: "ui-properties-input ui-properties-list-input-small",
        attr: { placeholder: "Value" },
      });

      // Message input
      const msgInput = itemEl.createEl("input", {
        type: "text",
        value: rule.message || "",
        cls: "ui-properties-input ui-properties-list-input",
        attr: { placeholder: "Error message" },
      });

      // Remove button
      const removeBtn = itemEl.createEl("button", {
        text: "×",
        cls: "ui-properties-list-remove",
      });

      typeSelect.addEventListener("change", () => {
        const newValidation = [...validation];
        newValidation[index] = { ...newValidation[index], type: typeSelect.value as BindValidationType };
        onChange(newValidation);
      });

      valueInput.addEventListener("change", () => {
        const newValidation = [...validation];
        const val = valueInput.value;
        // Try to parse as number if it looks like one
        const numVal = parseFloat(val);
        newValidation[index] = {
          ...newValidation[index],
          value: val ? (isNaN(numVal) ? val : numVal) : undefined,
        };
        onChange(newValidation);
      });

      msgInput.addEventListener("change", () => {
        const newValidation = [...validation];
        newValidation[index] = {
          ...newValidation[index],
          message: msgInput.value || undefined,
        };
        onChange(newValidation);
      });

      removeBtn.addEventListener("click", () => {
        const newValidation = validation.filter((_, i) => i !== index);
        onChange(newValidation);
      });
    });

    // Add validation rule button
    const addBtn = container.createEl("button", {
      text: "+ Add Rule",
      cls: "ui-properties-list-add",
    });
    addBtn.addEventListener("click", () => {
      const newValidation = [...validation, { type: "required" as BindValidationType }];
      onChange(newValidation);
    });
  }
}
