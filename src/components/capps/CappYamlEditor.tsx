import React from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import CodeEditor, { type Monaco } from "@monaco-editor/react";
import { Sheet } from "@/components/layout/Sheet";
import { useThemeStore } from "@/store/theme";

const bare = (c: string) => c.slice(1, 7);

/** Monaco needs literal hex, so these mirror the theme.css tokens (card, text, surface, border, primary...). */
function defineInkThemes(monaco: Monaco) {
  const make = (name: string, base: "vs" | "vs-dark", dark: boolean) => {
    const p = dark
      ? { bg: "#1B2221", fg: "#DDE6E3", muted: "#879693", sec: "#B4C1BD", surface: "#171D1C", border: "#26302E", seal: "#5FB8A3", ok: "#86C28F", warn: "#D4A64F" }
      : { bg: "#FFFFFF", fg: "#1E2A2B", muted: "#586968", sec: "#3F4F4E", surface: "#EEF1EF", border: "#D5DDDA", seal: "#2F7A6B", ok: "#2B7544", warn: "#8A5A12" };
    monaco.editor.defineTheme(name, {
      base,
      inherit: true,
      rules: [
        { token: "", foreground: bare(p.fg) },
        { token: "comment", foreground: bare(p.muted), fontStyle: "italic" },
        { token: "type", foreground: bare(p.seal) },
        { token: "tag", foreground: bare(p.seal) },
        { token: "key", foreground: bare(p.seal) },
        { token: "string", foreground: bare(p.sec) },
        { token: "string.yaml", foreground: bare(p.sec) },
        { token: "number", foreground: bare(p.warn) },
        { token: "keyword", foreground: bare(p.ok) },
        { token: "delimiter", foreground: bare(p.muted) },
        { token: "operators", foreground: bare(p.muted) },
        { token: "meta", foreground: bare(p.muted) },
      ],
      colors: {
        "editor.background": p.bg,
        "editor.foreground": p.fg,
        "editorLineNumber.foreground": p.muted,
        "editorLineNumber.activeForeground": p.sec,
        "editor.lineHighlightBackground": p.surface,
        "editor.lineHighlightBorder": p.surface,
        "editor.selectionBackground": p.border + "99",
        "editor.inactiveSelectionBackground": p.border + "55",
        "editorCursor.foreground": p.seal,
        "editorIndentGuide.background1": p.border + "88",
        "editorIndentGuide.activeBackground1": p.border,
        "editorWhitespace.foreground": p.border,
        "editorWidget.background": p.surface,
        "editorWidget.border": p.border,
        "editorSuggestWidget.background": p.surface,
        "editorSuggestWidget.border": p.border,
        "editorSuggestWidget.selectedBackground": p.border + "88",
        "scrollbarSlider.background": p.border + "88",
        "scrollbarSlider.hoverBackground": p.border,
        "scrollbarSlider.activeBackground": p.muted,
        "focusBorder": p.seal,
      },
    });
  };
  make("rice-paper", "vs", false);
  make("ink-night", "vs-dark", true);
}

interface CappYamlEditorProps {
  handleYamlChange: (value: string) => void;
  yamlContent: string;
  yamlError: string;
}

export const CappYamlEditor: React.FC<CappYamlEditorProps> = ({
  handleYamlChange,
  yamlContent,
  yamlError,
}) => {
  const lineCount = yamlContent.split("\n").length;

  const dark = useThemeStore((st) => st.dark);

  const handleEditorWillMount = (monacoInstance: Monaco) => {
    defineInkThemes(monacoInstance);
  };

  return (
    <div className="flex flex-col gap-2">
      <Sheet className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
          <span className="font-sans text-[13px] font-medium text-text-secondary">
            YAML Editor
          </span>
          <span className="font-mono text-xs tabular-nums text-text-muted">{lineCount} lines</span>
        </div>
        <CodeEditor
          height="min(70vh, 720px)"
          defaultLanguage="yaml"
          value={yamlContent}
          onChange={(value) => handleYamlChange(value || "")}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
            renderLineHighlight: "line",
            overviewRulerBorder: false,
            padding: { top: 10, bottom: 10 },
            wordWrap: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
          beforeMount={handleEditorWillMount}
          theme={dark ? "ink-night" : "rice-paper"}
        />
      </Sheet>
      {yamlError && (
        <Alert variant="destructive">
          <WarningCircle className="h-4 w-4" />
          <AlertDescription>YAML parse error: {yamlError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};
