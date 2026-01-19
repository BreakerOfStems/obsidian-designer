# Obsidian UI Designer

A visual UI layout designer plugin for Obsidian. Create and edit UI mockups with a canvas-based editor, storing designs in a language-agnostic JSON format.

## Features

- **Visual Canvas Editor** - Drag, move, and resize UI elements on an HTML5 canvas
- **Language-Agnostic Format** - UI designs stored as `.uidesign` JSON files, not tied to any framework
- **Design Tokens** - Reusable colors, spacing, and style values
- **Node Tree Panel** - Hierarchical view of your UI structure
- **Properties Panel** - Edit position, size, and style properties
- **Multi-Select** - Select multiple elements (Shift+click) and move them together
- **Copy/Paste** - Copy, cut, paste, and duplicate components (Ctrl+C/X/V/D)
- **Undo/Redo** - Full session undo/redo support (Ctrl+Z/Y)
- **Auto-Reparenting** - Elements automatically become children of containers when dropped onto them
- **Snap-to-Grid** - Align elements precisely with grid snapping

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

| Action | Control |
|--------|---------|
| Pan | Middle-click drag or Alt + drag |
| Zoom | Ctrl + scroll wheel |
| Select | Click on element |
| Multi-select | Shift + click |
| Move | Drag selected element(s) |
| Resize | Drag corner/edge handles |
| Delete | Delete or Backspace key |
| Copy | Ctrl+C |
| Cut | Ctrl+X |
| Paste | Ctrl+V |
| Duplicate | Ctrl+D |
| Undo | Ctrl+Z |
| Redo | Ctrl+Y or Ctrl+Shift+Z |
| Select All | Ctrl+A |

### Adding Elements

Use the toolbar buttons to add new elements:
- **Container** - Layout container for grouping elements
- **Button** - Clickable button element
- **Text** - Text label
- **Input** - Text input field
- **Image** - Image placeholder

### Properties Panel

Select an element to edit its properties:
- **Position** - X, Y coordinates
- **Size** - Width, Height
- **Style** - Background color, text color, border radius

## File Format

UI designs are stored as JSON with the `.uidesign` extension:

```json
{
  "version": "1.0",
  "name": "My Design",
  "tokens": {
    "color.primary": "#2E6BE6",
    "color.background": "#FFFFFF",
    "space.md": 16
  },
  "screens": {
    "main": {
      "id": "main",
      "name": "Main Screen",
      "root": {
        "id": "root",
        "type": "Container",
        "layout": { "mode": "absolute", "x": 0, "y": 0, "w": 375, "h": 667 },
        "children": []
      }
    }
  }
}
```

### Element Types

| Type | Description |
|------|-------------|
| Container | Layout container, can have children |
| Button | Clickable button with text |
| Text | Static text label |
| Input | Text input field |
| Image | Image placeholder |

### Layout

Elements use absolute positioning with:
- `x`, `y` - Position relative to parent
- `w`, `h` - Width and height

## Commands

| Command | Description |
|---------|-------------|
| Create new UI design file | Creates a new `.uidesign` file |
| Open node tree panel | Shows hierarchy sidebar |
| Open properties panel | Shows properties sidebar |

## License

MIT
