export type Language =
  | "python"
  | "go"
  | "java"
  | "ruby"
  | "typescript"
  | "javascript"
  | "unknown";

export function detectLanguage(changedFiles: string[]): Language {
  for (const file of changedFiles) {
    if (file.endsWith(".py")) return "python";
    if (file.endsWith(".go")) return "go";
    if (file.endsWith(".java") || file.endsWith(".kt")) return "java";
    if (file.endsWith(".rb")) return "ruby";
    if (file.endsWith(".ts") || file.endsWith(".tsx")) return "typescript";
    if (file.endsWith(".js") || file.endsWith(".jsx")) return "javascript";
  }
  return "unknown";
}

export function getTestFilePattern(lang: Language): RegExp {
  switch (lang) {
    case "python":
      return /test_.*\.py$|.*_test\.py$/;
    case "go":
      return /.*_test\.go$/;
    case "java":
      return /.*Test\.java$|.*Tests\.java$|.*Spec\.kt$/;
    case "ruby":
      return /spec\/.*_spec\.rb$|test\/.*_test\.rb$/;
    case "typescript":
      return /.*\.test\.ts$|.*\.spec\.ts$|.*\.test\.tsx$/;
    case "javascript":
      return /.*\.test\.js$|.*\.spec\.js$|.*\.test\.jsx$/;
    default:
      return /test/i;
  }
}
