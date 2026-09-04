export interface StructuredInstructions {
  instructions: string[];
  checklist: string[];
}

export function parseStructuredInstructions(text: string | null): StructuredInstructions {
  const result: StructuredInstructions = { instructions: [], checklist: [] };
  let section: keyof StructuredInstructions = "instructions";
  for (const rawLine of (text || "").split("\n")) {
    const line = rawLine.trim();
    if (!line || line === "Instructions" || line === "Directions") continue;
    if (line === "Before you submit" || line === "Self-check") {
      section = "checklist";
      continue;
    }
    result[section].push(line.replace(/^\d+\.\s*/, "").replace(/^[-*]\s*/, ""));
  }
  return result;
}

export function moduleLabel(module?: { title: string; display_order: number } | null) {
  if (!module) return "Course";
  return module.display_order === 0 ? "Introduction" : `Module ${module.display_order}`;
}
