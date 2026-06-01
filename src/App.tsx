import React, { useState } from "react";
import CategoryPicker, { CategorySelection } from "./CategoryPicker";

function App() {
  const [mode, setMode] = useState<"leaf" | "any">("any");
  const [last, setLast] = useState<CategorySelection | null>(null);

  return (
    <div className="max-w-md mx-auto py-10 px-4">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Category Picker</h2>
        <p className="text-sm text-gray-500">Standalone demo (port 3003)</p>
      </div>

      <div className="mb-4 flex gap-2 text-sm">
        {(["leaf", "any"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-lg border transition-colors ${
              mode === m
                ? "bg-indigo-600 text-white border-indigo-600"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            selectionMode="{m}"
          </button>
        ))}
      </div>

      <CategoryPicker
        selectionMode={mode}
        onSelect={(sel) => setLast(sel)}
        onCancel={() => setLast(null)}
      />

      {last && (
        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm">
          <p className="text-gray-700 font-medium mb-1">onSelect:</p>
          <p className="text-gray-600">
            #{last.id} — {last.name}
          </p>
          <p className="text-gray-400 text-xs mt-1">
            {last.path.map((p) => p.name).join(" / ")}
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
