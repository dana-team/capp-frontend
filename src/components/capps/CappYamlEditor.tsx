import React from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import CodeEditor from "@monaco-editor/react";
import * as monaco from "monaco-editor";

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

  const handleEditorWillMount = (monacoInstance: typeof monaco) => {
    monacoInstance.editor.defineTheme("myTheme", {
      base: "vs",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#f5ede0",
      },
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
            YAML Editor
          </span>
          <span className="text-xs text-text-muted">{lineCount} lines</span>
        </div>
        <CodeEditor
          height="400px"
          defaultLanguage="yaml"
          value={yamlContent}
          onChange={(value) => handleYamlChange(value || "")}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
          beforeMount={handleEditorWillMount}
          theme="myTheme"
        />
      </div>
      {yamlError && (
        <Alert variant="destructive">
          <WarningCircle className="h-4 w-4" />
          <AlertDescription>YAML parse error: {yamlError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};
