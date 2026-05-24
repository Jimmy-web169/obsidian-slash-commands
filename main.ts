import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  Modal,
  Notice,
  Plugin,
  TFile,
  parseYaml,
  requestUrl,
  setIcon,
} from "obsidian";

interface CardData {
  url: string;
  title: string;
  description: string;
  image: string;
  site_name: string;
}

async function fetchOgData(url: string): Promise<CardData> {
  const res = await requestUrl({ url, throw: false });
  if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
  const dom = new DOMParser().parseFromString(res.text, "text/html");

  const meta = (selector: string): string =>
    dom.querySelector(selector)?.getAttribute("content")?.trim() ?? "";

  const title =
    meta('meta[property="og:title"]') ||
    meta('meta[name="twitter:title"]') ||
    dom.querySelector("title")?.textContent?.trim() ||
    url;

  const description =
    meta('meta[property="og:description"]') ||
    meta('meta[name="twitter:description"]') ||
    meta('meta[name="description"]') ||
    "";

  let image =
    meta('meta[property="og:image"]') ||
    meta('meta[name="twitter:image"]') ||
    meta('meta[name="twitter:image:src"]') ||
    "";
  if (image && !/^https?:/i.test(image)) {
    try {
      image = new URL(image, url).toString();
    } catch {
      image = "";
    }
  }

  let site_name = meta('meta[property="og:site_name"]');
  if (!site_name) {
    try {
      site_name = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      site_name = "";
    }
  }

  return { url, title, description, image, site_name };
}

function yamlString(v: string): string {
  return '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ") + '"';
}

function formatCardBlock(d: CardData): string {
  const lines = [
    "```cardlink",
    `url: ${yamlString(d.url)}`,
    `title: ${yamlString(d.title)}`,
  ];
  if (d.description) lines.push(`description: ${yamlString(d.description)}`);
  if (d.image) lines.push(`image: ${yamlString(d.image)}`);
  if (d.site_name) lines.push(`site_name: ${yamlString(d.site_name)}`);
  lines.push("```");
  return lines.join("\n");
}

function renderCard(el: HTMLElement, d: CardData): void {
  el.empty();
  const a = el.createEl("a", {
    cls: "slash-card",
    href: d.url,
  });
  a.setAttr("target", "_blank");
  a.setAttr("rel", "noopener");

  const body = a.createDiv({ cls: "slash-card-body" });
  if (d.title) body.createDiv({ cls: "slash-card-title", text: d.title });
  if (d.description) body.createDiv({ cls: "slash-card-desc", text: d.description });
  if (d.site_name) body.createDiv({ cls: "slash-card-site", text: d.site_name });

  if (d.image) {
    const img = a.createEl("img", { cls: "slash-card-thumb" });
    img.setAttr("src", d.image);
    img.setAttr("alt", "");
    img.addEventListener("error", () => img.remove());
  }
}

interface SlashCommand {
  id: string;
  name: string;
  description: string;
  icon: string;
  aliases?: string[];
  action: (editor: Editor, app: App) => void;
}

class UrlPromptModal extends Modal {
  private title: string;
  private onSubmit: (url: string) => void;

  constructor(app: App, title: string, onSubmit: (url: string) => void) {
    super(app);
    this.title = title;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: this.title });
    const input = contentEl.createEl("input", {
      type: "text",
      attr: { placeholder: "https://..." },
    });
    input.style.width = "100%";
    input.style.padding = "6px 8px";
    input.style.fontSize = "var(--font-ui-medium)";
    setTimeout(() => input.focus(), 0);
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        const url = input.value.trim();
        if (url) {
          this.close();
          this.onSubmit(url);
        }
      } else if (ev.key === "Escape") {
        this.close();
      }
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

function promptForUrl(
  editor: Editor,
  app: App,
  title: string,
  formatter: (url: string) => string
): void {
  const cur = editor.getCursor();
  new UrlPromptModal(app, title, (url) => {
    const text = formatter(url);
    editor.replaceRange(text, cur);
    editor.setCursor({ line: cur.line, ch: cur.ch + text.length });
    editor.focus();
  }).open();
}

function prependToLine(editor: Editor, prefix: string): void {
  const cur = editor.getCursor();
  const line = editor.getLine(cur.line);
  editor.setLine(cur.line, prefix + line);
  editor.setCursor({ line: cur.line, ch: prefix.length + line.length });
}

function insertAtCursor(editor: Editor, text: string, cursorOffsetFromStart?: number): void {
  const cur = editor.getCursor();
  editor.replaceRange(text, cur);
  const ch = cursorOffsetFromStart ?? text.length;
  editor.setCursor({ line: cur.line, ch: cur.ch + ch });
}

function insertBlock(
  editor: Editor,
  text: string,
  cursorLineOffset: number,
  cursorCh: number
): void {
  const cur = editor.getCursor();
  const line = editor.getLine(cur.line);
  const blockLines = text.split("\n");
  if (line.trim() === "") {
    editor.setLine(cur.line, text);
    const lineIdx =
      cursorLineOffset < 0 ? cur.line + blockLines.length + cursorLineOffset : cur.line + cursorLineOffset;
    editor.setCursor({ line: lineIdx, ch: cursorCh });
  } else {
    editor.replaceRange("\n" + text, { line: cur.line, ch: line.length });
    const baseLine = cur.line + 1;
    const lineIdx =
      cursorLineOffset < 0 ? baseLine + blockLines.length + cursorLineOffset : baseLine + cursorLineOffset;
    editor.setCursor({ line: lineIdx, ch: cursorCh });
  }
}

const COMMANDS: SlashCommand[] = [
  {
    id: "h1",
    name: "Heading 1",
    description: "Large heading",
    icon: "heading-1",
    aliases: ["#", "heading1"],
    action: (e) => prependToLine(e, "# "),
  },
  {
    id: "h2",
    name: "Heading 2",
    description: "Medium heading",
    icon: "heading-2",
    aliases: ["##", "heading2"],
    action: (e) => prependToLine(e, "## "),
  },
  {
    id: "h3",
    name: "Heading 3",
    description: "Small heading",
    icon: "heading-3",
    aliases: ["###", "heading3"],
    action: (e) => prependToLine(e, "### "),
  },
  {
    id: "bullet",
    name: "Bulleted list",
    description: "- item",
    icon: "list",
    aliases: ["ul", "list", "-"],
    action: (e) => prependToLine(e, "- "),
  },
  {
    id: "num",
    name: "Numbered list",
    description: "1. item",
    icon: "list-ordered",
    aliases: ["ol", "number", "1."],
    action: (e) => prependToLine(e, "1. "),
  },
  {
    id: "todo",
    name: "To-do list",
    description: "- [ ] task",
    icon: "check-square",
    aliases: ["task", "check", "checkbox"],
    action: (e) => prependToLine(e, "- [ ] "),
  },
  {
    id: "quote",
    name: "Quote",
    description: "> blockquote",
    icon: "quote",
    aliases: ["blockquote", ">"],
    action: (e) => prependToLine(e, "> "),
  },
  {
    id: "code",
    name: "Code block",
    description: "Fenced code block",
    icon: "code",
    aliases: ["codeblock", "```"],
    action: (e) => insertBlock(e, "```\n\n```", -1, 0),
  },
  {
    id: "div",
    name: "Divider",
    description: "Horizontal rule",
    icon: "minus",
    aliases: ["divider", "hr", "---"],
    action: (e) => insertBlock(e, "---", 1, 0),
  },
  {
    id: "table",
    name: "Table",
    description: "Markdown table",
    icon: "table",
    aliases: ["tbl"],
    action: (e) =>
      insertBlock(
        e,
        "| Header 1 | Header 2 |\n| -------- | -------- |\n| Cell 1   | Cell 2   |",
        0,
        2
      ),
  },
  {
    id: "callout",
    name: "Callout",
    description: "> [!note] block",
    icon: "info",
    aliases: ["admonition", "note"],
    action: (e) => insertBlock(e, "> [!note]\n> ", 1, 2),
  },
  {
    id: "link",
    name: "Internal link",
    description: "[[ page ]]",
    icon: "link",
    aliases: ["wikilink"],
    action: (e) => insertAtCursor(e, "[[]]", 2),
  },
  {
    id: "embed",
    name: "Embed / transclude",
    description: "![[ note ]]",
    icon: "file-symlink",
    aliases: ["transclude"],
    action: (e) => insertAtCursor(e, "![[]]", 3),
  },
  {
    id: "video",
    name: "Video embed (URL)",
    description: "![](URL) — YouTube / Vimeo / .mp4",
    icon: "play-circle",
    aliases: ["youtube", "yt", "vimeo", "mp4"],
    action: (e, app) => promptForUrl(e, app, "Paste video URL", (url) => `![](${url})`),
  },
  {
    id: "iframe",
    name: "Iframe embed",
    description: "<iframe> for any embeddable URL",
    icon: "code-2",
    aliases: ["embed-html", "frame"],
    action: (e, app) =>
      promptForUrl(
        e,
        app,
        "Paste embed URL (iframe src)",
        (url) =>
          `<iframe src="${url}" width="560" height="315" frameborder="0" allowfullscreen></iframe>`
      ),
  },
  {
    id: "bookmark",
    name: "Link bookmark",
    description: "[title](url) — clean external link",
    icon: "bookmark",
    aliases: ["book", "url"],
    action: (e) => insertAtCursor(e, "[]()", 1),
  },
  {
    id: "card",
    name: "Link card",
    description: "Rich preview card with thumbnail, title, description",
    icon: "image",
    aliases: ["cardlink", "preview", "richlink", "og"],
    action: (e, app) => {
      const cur = e.getCursor();
      new UrlPromptModal(app, "Paste URL for card preview", async (url) => {
        const line = e.getLine(cur.line);
        const onOwnLine = line.trim() === "" && cur.ch === 0;
        const notice = new Notice("Fetching card preview…", 0);
        try {
          const data = await fetchOgData(url);
          const block = formatCardBlock(data);
          const text = onOwnLine ? block : "\n" + block + "\n";
          e.replaceRange(text, cur);
          notice.hide();
          new Notice("Card inserted");
        } catch (err) {
          notice.hide();
          const msg = err instanceof Error ? err.message : String(err);
          new Notice(`Card fetch failed: ${msg}. Inserted plain link.`);
          e.replaceRange(`[${url}](${url})`, cur);
        }
      }).open();
    },
  },
  {
    id: "math",
    name: "Math block",
    description: "$$ LaTeX $$",
    icon: "sigma",
    aliases: ["latex"],
    action: (e) => insertBlock(e, "$$\n\n$$", -1, 0),
  },
  {
    id: "mermaid",
    name: "Mermaid diagram",
    description: "```mermaid ... ```",
    icon: "git-merge",
    aliases: ["diagram", "flowchart"],
    action: (e) => insertBlock(e, "```mermaid\n\n```", -1, 0),
  },
];

class SlashSuggest extends EditorSuggest<SlashCommand> {
  constructor(app: App) {
    super(app);
  }

  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
    _file: TFile
  ): EditorSuggestTriggerInfo | null {
    const sub = editor.getLine(cursor.line).substring(0, cursor.ch);
    const m = sub.match(/(?:^|\s)\/([a-zA-Z0-9#`>!\-]*)$/);
    if (!m) return null;
    const matchOffset = sub.length - m[0].length;
    const slashCh = m[0].startsWith("/") ? matchOffset : matchOffset + 1;
    return {
      start: { line: cursor.line, ch: slashCh },
      end: cursor,
      query: m[1],
    };
  }

  getSuggestions(ctx: EditorSuggestContext): SlashCommand[] {
    const q = ctx.query.toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) => {
      const keys = [c.id, c.name, ...(c.aliases ?? [])].map((s) => s.toLowerCase());
      return keys.some((k) => k.includes(q));
    });
  }

  renderSuggestion(cmd: SlashCommand, el: HTMLElement): void {
    el.addClass("slash-suggestion");
    const iconEl = el.createSpan({ cls: "slash-suggestion-icon" });
    setIcon(iconEl, cmd.icon);
    const body = el.createDiv({ cls: "slash-suggestion-body" });
    body.createDiv({ cls: "slash-suggestion-title", text: cmd.name });
    body.createDiv({ cls: "slash-suggestion-desc", text: cmd.description });
  }

  selectSuggestion(cmd: SlashCommand, _evt: MouseEvent | KeyboardEvent): void {
    const ctx = this.context;
    if (!ctx) return;
    const editor = ctx.editor;
    editor.replaceRange("", ctx.start, ctx.end);
    editor.setCursor(ctx.start);
    this.close();
    cmd.action(editor, this.app);
  }
}

export default class SlashCommandsPlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerEditorSuggest(new SlashSuggest(this.app));

    this.registerMarkdownCodeBlockProcessor("cardlink", (source, el) => {
      let parsed: Partial<CardData> = {};
      try {
        parsed = (parseYaml(source) ?? {}) as Partial<CardData>;
      } catch {
        el.createDiv({ text: "Invalid cardlink block", cls: "slash-card-error" });
        return;
      }
      const data: CardData = {
        url: parsed.url ?? "",
        title: parsed.title ?? parsed.url ?? "",
        description: parsed.description ?? "",
        image: parsed.image ?? "",
        site_name: parsed.site_name ?? "",
      };
      if (!data.url) {
        el.createDiv({ text: "cardlink: missing url", cls: "slash-card-error" });
        return;
      }
      renderCard(el, data);
    });
  }
}
