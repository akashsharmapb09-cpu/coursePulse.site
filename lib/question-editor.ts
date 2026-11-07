export function moveQuestion<T>(questions: readonly T[], from: number, to: number): T[] {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= questions.length || to >= questions.length) {
    return [...questions];
  }
  const next = [...questions];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function normalizeQuestionOptions(options: readonly string[] | undefined): string[] | undefined {
  if (!options) return undefined;
  return options.map(option => option.trim()).filter(Boolean);
}
