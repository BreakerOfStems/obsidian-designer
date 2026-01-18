# Obsidian Plugin Spec: UI Language + Semantic Documentation Tool

## Objective

Create an Obsidian plugin that:

1. Provides a **visual UI layout designer** backed by a **language-agnostic UI description format**.
2. Generates **explicit, structured documentation** from UI designs.
3. Surfaces **related text across the vault**, including semantic similarity (embeddings), to keep documentation consistent as it evolves.

The system must be implementation-agnostic (not tied to web, Unity, Flutter, etc.) and suitable as a source-of-truth spec.

---

## Part 1: UI Layout Language

### Design Goals

* Explicit and unambiguous
* Human-readable when rendered to Markdown
* Machine-parseable (JSON/YAML)
* Stable across tech stacks
* Supports layout, style, content, and intent (meta)

### Core Concepts

#### Document

* Represents one UI spec
* Stored as `ui.<name>.json`
* Optionally rendered to `ui.<name>.md`

```json
{
  "tokens": {},
  "components": {},
  "screens": {}
}
```

---

### Tokens (Design System)

Named, reusable values.

```json
"tokens": {
  "color.primary": "#2E6BE6",
  "color.text": "#FFFFFF",
  "font.body": "Inter",
  "space.sm": 8,
  "space.md": 16
}
```

---

### Nodes (UI Elements)

All UI elements are nodes.

#### Common Fields

```json
{
  "id": "submit_button",
  "type": "Button",
  "layout": {},
  "style": {},
  "content": {},
  "meta": {}
}
```

#### Layout (Implementation-Agnostic)

Supported primitives:

* Absolute positioning
* Constraints
* Auto-layout containers

```json
"layout": {
  "mode": "auto",
  "direction": "vertical",
  "gap": "space.sm",
  "padding": "space.md",
  "align": "center"
}
```

OR

```json
"layout": {
  "mode": "absolute",
  "x": 120,
  "y": 64,
  "w": 240,
  "h": 48
}
```

---

### Style

Style references tokens by default, with overrides allowed.

```json
"style": {
  "background": "color.primary",
  "textColor": "color.text",
  "borderRadius": 6
}
```

---

### Content

Text, icons, or semantic placeholders.

```json
"content": {
  "text": "Submit",
  "icon": "send"
}
```

---

### Meta (Critical)

Meta describes **intent and behavior**, not appearance.

```json
"meta": {
  "purpose": "Primary form submission action",
  "behavior": "Validates input and submits to API",
  "states": ["default", "loading", "disabled", "error"],
  "notes": "Disabled until all required fields are valid",
  "related": ["auth_flow", "form_validation"]
}
```

Meta is first-class and must be editable in the UI.

---

## Part 2: Obsidian UI Editor

### Custom View

* Canvas-based editor
* Drag/move/resize nodes
* Nesting via containers

### Panels

* **Left**: Node tree / hierarchy
* **Center**: Canvas
* **Right**: Properties (layout, style, content, meta)
* **Bottom**: Live-generated Markdown spec preview

### Persistence

* Source of truth: `ui.<name>.json`
* Markdown spec is generated (read-only or regen-on-save)

---

## Part 3: Documentation Generator

### Generated Markdown Sections

* Overview / Purpose
* Design Tokens
* Screens
* Components
* Element-by-element breakdown
* Behavioral notes and edge cases

Each UI node becomes a documented block:

* Name
* Screenshot/diagram (optional)
* Layout description
* Style tokens used
* Meta intent

---

## Part 4: Vault-Wide Related Text (Semantic Assistance)

### Goal

When editing text or UI meta, surface **related content elsewhere in the vault**, even across files.

---

### Level A: Structural + Heuristic Linking (MVP)

* Backlinks and forward links
* Tag overlap
* Heading similarity
* Filename and identifier matching

Displayed in a **Related Panel**.

---

### Level B: Semantic Linking (Embeddings)

#### Chunking

* Notes split by heading or ~300–800 tokens

#### Embeddings

* Each chunk embedded and indexed
* Query embedding generated from:

  * Selected text
  * Current paragraph
  * UI node meta (purpose/behavior)

#### Storage

* Local index (plugin-managed)
* ID → note path + heading + snippet

#### UI

* Side panel showing top-k similar chunks
* Similarity score
* One-click actions:

  * Open note
  * Insert link
  * Add to `related` meta

---

### Embedding Backends (Pluggable)

* Preferred: local HTTP service (e.g. Ollama / sentence-transformers)
* Optional: in-plugin inference (WebGPU / WASM)
* Cloud APIs explicitly optional

---

## Non-Goals

* No code generation
* No framework-specific output
* No requirement to render pixel-perfect previews

---

## Success Criteria

* UI designs are readable without the editor
* Specs survive tech stack changes
* Meta intent is explicit and searchable
* Related-doc suggestions feel obvious and useful

---

## Future Extensions (Out of Scope)

* Issue tracking export
* Live collaboration
* Design linting / rule engines
