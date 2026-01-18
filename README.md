# Obsidian UI Designer

A visual UI layout designer plugin for Obsidian with a language-agnostic UI description format and documentation generation.

## Features

- **Visual Canvas Editor** - Drag, move, and resize UI elements on an HTML5 canvas
- **Language-Agnostic Format** - UI designs stored as `.uidesign` JSON files, not tied to any framework
- **Design Tokens** - Reusable colors, spacing, and style values
- **Inline Properties Panel** - Edit position, size, colors, and documentation inline
- **Node Tree** - Hierarchical view of your UI structure
- **Markdown Export** - Generate structured documentation from your designs
- **Snap-to-Grid** - Align elements precisely with toggleable grid snapping

## Installation

### Manual Installation

1. Download the latest release
2. Extract to your vault's `.obsidian/plugins/obsidian-ui-designer/` folder
3. Enable the plugin in Obsidian Settings > Community Plugins

### Build from Source

```bash
npm install
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugin folder.

## Usage

### Creating a Design

- Click the layout icon in the ribbon, or
- Use Command Palette: "Create new UI design file"

### Editor Controls

- **Pan**: Middle-click drag or Space + drag
- **Zoom**: Scroll wheel
- **Select**: Click on a node
- **Move**: Drag selected node
- **Resize**: Drag corner/edge handles
- **Add Node**: Use toolbar buttons (Container, Button, Text, Input, Image)
- **Delete**: Select node and press Delete key

### Properties Panel

Select a node to edit its properties in the right panel:

- **Position & Size** - X, Y, Width, Height
- **Style** - Background color, text color
- **Content** - Text content
- **Documentation** - Purpose, behavior, states, related concepts

### Generating Documentation

Use Command Palette: "Generate Markdown documentation" to export your design as a `.md` file.

## File Format

UI designs are stored as JSON with the following structure:

```json
{
  "version": "1.0",
  "name": "My Design",
  "tokens": {
    "color.primary": "#2E6BE6",
    "space.md": 16
  },
  "components": {},
  "screens": {
    "main": {
      "id": "main",
      "name": "Main Screen",
      "root": { ... }
    }
  }
}
```

### Node Structure

Each UI element has:

- **id** - Unique identifier
- **type** - Container, Button, Text, Input, Image
- **layout** - Position and size (absolute or auto-layout)
- **style** - Visual properties (colors, borders)
- **content** - Text and icon content
- **meta** - Documentation (purpose, behavior, states, notes)

## Commands

| Command | Description |
|---------|-------------|
| Create new UI design file | Creates a new `.uidesign` file |
| Generate Markdown documentation | Exports design to Markdown |
| Open node tree panel | Shows hierarchy sidebar |
| Open properties panel | Shows properties sidebar |

## License

MIT
