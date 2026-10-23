import { Extension } from "@tiptap/core";

export type ShortcutPlatform = "mac" | "windows";

export type EditorShortcutDefinition = {
  id: string;
  label: string;
  shortcut: string;
  description: string;
  category: "Formatting" | "Structure" | "Literary" | "Insert" | "Editor";
};

export type EditorShortcutCallbacks = {
  onLink?: () => void;
  onIndent?: () => void;
  onOutdent?: () => void;
  onInsertImage?: () => void;
  onInsertEmoji?: () => void;
  onSave?: () => void;
  onTogglePreview?: () => void;
  onToggleFocusMode?: () => void;
  onOpenHelp?: () => void;
  onLiteraryTreatment?: (treatment: string) => void;
};

export const editorShortcutDefinitions: readonly EditorShortcutDefinition[] = [
  { id: "bold", label: "Bold", shortcut: "Mod-b", description: "Toggle bold text", category: "Formatting" },
  { id: "italic", label: "Italic", shortcut: "Mod-i", description: "Toggle italic text", category: "Formatting" },
  { id: "underline", label: "Underline", shortcut: "Mod-u", description: "Toggle underlined text", category: "Formatting" },
  { id: "strike", label: "Strikethrough", shortcut: "Mod-Shift-s", description: "Toggle strikethrough text", category: "Formatting" },
  { id: "code", label: "Inline code", shortcut: "Mod-e", description: "Toggle inline code", category: "Formatting" },
  { id: "highlight", label: "Highlight", shortcut: "Mod-Shift-h", description: "Toggle highlighted text", category: "Formatting" },
  { id: "spoiler", label: "Spoiler", shortcut: "Mod-Alt-s", description: "Hide or reveal selected text", category: "Formatting" },
  { id: "superscript", label: "Superscript", shortcut: "Mod-.", description: "Toggle superscript text", category: "Formatting" },
  { id: "subscript", label: "Subscript", shortcut: "Mod-,", description: "Toggle subscript text", category: "Formatting" },
  { id: "heading-1", label: "Heading 1", shortcut: "Mod-Alt-1", description: "Toggle a level-one heading", category: "Structure" },
  { id: "heading-2", label: "Heading 2", shortcut: "Mod-Alt-2", description: "Toggle a level-two heading", category: "Structure" },
  { id: "heading-3", label: "Heading 3", shortcut: "Mod-Alt-3", description: "Toggle a level-three heading", category: "Structure" },
  { id: "paragraph", label: "Paragraph", shortcut: "Mod-Alt-0", description: "Change the current block to a paragraph", category: "Structure" },
  { id: "blockquote", label: "Blockquote", shortcut: "Mod-Shift-b", description: "Toggle a blockquote", category: "Structure" },
  { id: "bullet-list", label: "Bulleted list", shortcut: "Mod-Shift-8", description: "Toggle a bulleted list", category: "Structure" },
  { id: "ordered-list", label: "Numbered list", shortcut: "Mod-Shift-7", description: "Toggle a numbered list", category: "Structure" },
  { id: "align-left", label: "Align left", shortcut: "Mod-Shift-l", description: "Align the current block left", category: "Structure" },
  { id: "align-center", label: "Align center", shortcut: "Mod-Shift-e", description: "Center the current block", category: "Structure" },
  { id: "align-right", label: "Align right", shortcut: "Mod-Shift-r", description: "Align the current block right", category: "Structure" },
  { id: "align-justify", label: "Justify", shortcut: "Mod-Shift-j", description: "Justify the current block", category: "Structure" },
  { id: "indent", label: "Indent", shortcut: "Mod-]", description: "Increase paragraph indentation", category: "Structure" },
  { id: "outdent", label: "Outdent", shortcut: "Mod-[", description: "Decrease paragraph indentation", category: "Structure" },
  { id: "literary-dialogue", label: "Dialogue", shortcut: "Mod-Shift-1", description: "Toggle the dialogue style on the current block", category: "Literary" },
  { id: "literary-system", label: "System notice", shortcut: "Mod-Shift-2", description: "Toggle the system notice style on the current block", category: "Literary" },
  { id: "link", label: "Link", shortcut: "Mod-k", description: "Add or edit a link", category: "Insert" },
  { id: "image", label: "Image", shortcut: "Mod-Shift-i", description: "Open the image picker", category: "Insert" },
  { id: "emoji", label: "Emoji", shortcut: "Mod-Alt-;", description: "Open the emoji picker", category: "Insert" },
  { id: "save", label: "Save draft", shortcut: "Mod-s", description: "Save the current draft", category: "Editor" },
  { id: "preview", label: "Preview", shortcut: "Mod-Shift-p", description: "Toggle chapter preview", category: "Editor" },
  { id: "focus", label: "Focus mode", shortcut: "Mod-Shift-f", description: "Toggle distraction-free focus mode", category: "Editor" },
  { id: "help", label: "Keyboard shortcuts", shortcut: "Mod-Shift-/", description: "Show this shortcut reference", category: "Editor" },
];

export function detectShortcutPlatform(userAgent?: string): ShortcutPlatform {
  const value = userAgent ?? (typeof navigator === "undefined" ? "" : navigator.userAgent);
  return /Macintosh|Mac OS X|iPhone|iPad|iPod/i.test(value) ? "mac" : "windows";
}

export function formatShortcut(shortcut: string, platform: ShortcutPlatform): string {
  const parts = shortcut.split("-");
  const key = parts.pop() ?? "";
  const displayKey = /^[a-z]$/i.test(key) ? key.toUpperCase() : key;

  if (platform === "mac") {
    const modifierSymbols: Record<string, string> = { Mod: "⌘", Shift: "⇧", Alt: "⌥", Ctrl: "⌃" };
    return `${parts.map((part) => modifierSymbols[part] ?? part).join("")}${displayKey}`;
  }

  return `${parts.map((part) => part === "Mod" ? "Ctrl" : part).join("+")}${parts.length ? "+" : ""}${displayKey}`;
}

const runCallback = (callback?: () => void) => {
  callback?.();
  return true;
};

export function createEditorShortcutExtension(callbacks: { current: EditorShortcutCallbacks }) {
  return Extension.create({
    name: "editorShortcuts",
    addKeyboardShortcuts() {
      const { editor } = this;

      return {
        "Mod-b": () => editor.chain().focus().toggleBold().run(),
        "Mod-i": () => editor.chain().focus().toggleItalic().run(),
        "Mod-u": () => editor.chain().focus().toggleUnderline().run(),
        "Mod-Shift-s": () => editor.chain().focus().toggleStrike().run(),
        "Mod-e": () => editor.chain().focus().toggleCode().run(),
        "Mod-Shift-h": () => editor.chain().focus().toggleHighlight({ color: "#d4f36a" }).run(),
        "Mod-Alt-s": () => editor.chain().focus().toggleMark("spoiler").run(),
        "Mod-.": () => editor.chain().focus().toggleSuperscript().run(),
        "Mod-,": () => editor.chain().focus().toggleSubscript().run(),
        "Mod-Alt-1": () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        "Mod-Alt-2": () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        "Mod-Alt-3": () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        "Mod-Alt-0": () => editor.chain().focus().setParagraph().run(),
        "Mod-Shift-b": () => editor.chain().focus().toggleBlockquote().run(),
        "Mod-Shift-8": () => editor.chain().focus().toggleBulletList().run(),
        "Mod-Shift-7": () => editor.chain().focus().toggleOrderedList().run(),
        "Mod-Shift-l": () => editor.chain().focus().setTextAlign("left").run(),
        "Mod-Shift-e": () => editor.chain().focus().setTextAlign("center").run(),
        "Mod-Shift-r": () => editor.chain().focus().setTextAlign("right").run(),
        "Mod-Shift-j": () => editor.chain().focus().setTextAlign("justify").run(),
        "Mod-Shift-1": () => runCallback(() => callbacks.current.onLiteraryTreatment?.("dialogue")),
        "Mod-Shift-2": () => runCallback(() => callbacks.current.onLiteraryTreatment?.("system")),
        "Mod-[": () => runCallback(callbacks.current.onOutdent),
        "Mod-]": () => runCallback(callbacks.current.onIndent),
        "Mod-k": () => runCallback(callbacks.current.onLink),
        "Mod-Shift-i": () => runCallback(callbacks.current.onInsertImage),
        "Mod-Alt-;": () => runCallback(callbacks.current.onInsertEmoji),
        "Mod-s": () => runCallback(callbacks.current.onSave),
        "Mod-Shift-p": () => runCallback(callbacks.current.onTogglePreview),
        "Mod-Shift-f": () => runCallback(callbacks.current.onToggleFocusMode),
        "Mod-Shift-/": () => runCallback(callbacks.current.onOpenHelp),
      };
    },
  });
}
