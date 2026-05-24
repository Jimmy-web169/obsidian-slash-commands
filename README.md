# Slash Inserter

A Notion-style slash menu for Obsidian. Press `/` at the start of a line (or after a space) and pick a block from the list — headings, lists, callouts, code blocks, math, mermaid diagrams, internal links, video embeds, and rich link preview cards.

## Features

Type `/` then start typing the command name or alias. Press Enter (or click) to insert.

| Command | Aliases | Result |
| --- | --- | --- |
| `/h1` `/h2` `/h3` | `/#` `/##` `/###` | Headings |
| `/bullet` | `/ul` `/list` | `- item` |
| `/num` | `/ol` `/number` | `1. item` |
| `/todo` | `/task` `/check` | `- [ ] task` |
| `/quote` | `/blockquote` | `> quote` |
| `/callout` | `/admonition` `/note` | `> [!note]` callout |
| `/code` | `/codeblock` | Fenced code block |
| `/div` | `/divider` `/hr` | `---` |
| `/table` | `/tbl` | 2×3 markdown table |
| `/math` | `/latex` | `$$ … $$` block |
| `/mermaid` | `/diagram` `/flowchart` | Mermaid diagram block |
| `/link` | `/wikilink` | `[[ ]]` internal link |
| `/embed` | `/transclude` | `![[ ]]` transclusion |
| `/video` | `/youtube` `/vimeo` `/mp4` | `![](URL)` video embed |
| `/iframe` | `/frame` | `<iframe>` for any embeddable URL |
| `/bookmark` | `/book` `/url` | `[title](url)` external link |
| `/card` | `/cardlink` `/preview` | **Rich preview card** with thumbnail, title, description |

### Link cards

`/card` opens a small prompt, you paste a URL, and the plugin fetches OpenGraph metadata (title, description, og:image, site name) and inserts a clean preview card. The source is a `cardlink` code block that renders as a styled card in Live Preview and Reading mode — clicking the card opens the URL.

```cardlink
url: "https://example.com/article"
title: "Article title"
description: "Two-line description from og:description..."
image: "https://example.com/cover.jpg"
site_name: "example.com"
```

If a site blocks the request or has no OpenGraph metadata, the plugin falls back to inserting a plain markdown link and shows a notice.

### Video embeds

`/video` works with YouTube, Vimeo, and direct `.mp4` URLs — Obsidian natively renders these as embedded players inside `![](URL)`.

## Installation

### From Community Plugins (after approval)

1. Settings → Community plugins → Browse
2. Search for **Slash Inserter**
3. Install → Enable

### Manual install

1. Download `main.js`, `manifest.json`, `styles.css` from the latest [release](https://github.com/Jimmy-web169/obsidian-slash-commands/releases)
2. Place them in `<your-vault>/.obsidian/plugins/slash-commands/`
3. Reload Obsidian → Settings → Community plugins → enable **Slash Inserter**

### BRAT (beta)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. Add beta plugin: `Jimmy-web169/obsidian-slash-commands`
3. Enable it under Community plugins

## Trigger rules

- `/` only triggers the menu when it's at the **start of a line** or **after a whitespace** — so a `/` in the middle of a word (e.g., `and/or`) won't pop the menu.
- `Esc` closes the menu.
- Type any part of the command name or alias to filter.

## Development

```bash
git clone https://github.com/Jimmy-web169/obsidian-slash-commands
cd obsidian-slash-commands
npm install
npm run dev        # watch mode
npm run build      # production
```

Copy / symlink the folder to `<your-vault>/.obsidian/plugins/slash-commands/` and reload the plugin in Obsidian's settings.

## License

[MIT](./LICENSE)
