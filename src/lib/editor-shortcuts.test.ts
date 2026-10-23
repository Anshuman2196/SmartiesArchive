import test from "node:test";
import assert from "node:assert/strict";
import { createEditorShortcutExtension, detectShortcutPlatform, editorShortcutDefinitions, formatShortcut } from "./editor-shortcuts.ts";

test("the editor shortcut registry has one documented binding per action", () => {
  const bindings = editorShortcutDefinitions.map((definition) => definition.shortcut);

  assert.equal(new Set(bindings).size, bindings.length);
  assert.equal(editorShortcutDefinitions.length, 31);
  assert.deepEqual(new Set(editorShortcutDefinitions.map((definition) => definition.category)), new Set(["Formatting", "Structure", "Literary", "Insert", "Editor"]));
});

test("Mod labels adapt to the detected platform", () => {
  assert.equal(detectShortcutPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)"), "mac");
  assert.equal(detectShortcutPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "windows");
  assert.equal(formatShortcut("Mod-Shift-k", "mac"), "⌘⇧K");
  assert.equal(formatShortcut("Mod-Shift-k", "windows"), "Ctrl+Shift+K");
  assert.equal(formatShortcut("Mod-Alt-;", "mac"), "⌘⌥;");
});

test("the TipTap extension exposes every registry binding and keeps app actions editor-scoped", () => {
  let saves = 0;
  const extension = createEditorShortcutExtension({ current: { onSave: () => { saves += 1; } } });
  const addKeyboardShortcuts = extension.config.addKeyboardShortcuts;
  assert.ok(addKeyboardShortcuts);

  const bindings = addKeyboardShortcuts.call({ editor: {} } as never) as Record<string, (props: never) => boolean>;
  assert.deepEqual(Object.keys(bindings).sort(), editorShortcutDefinitions.map((definition) => definition.shortcut).sort());
  assert.equal(bindings["Mod-s"]({} as never), true);
  assert.equal(saves, 1);
});
