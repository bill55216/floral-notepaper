// 完成划线（删除线）相关的纯函数。
// 标记以「整行文本（去首尾空白）」为键保存，这样用户在笔记前后插入/删除行时，
// 已有的完成标记不会错位；被划线的行若文字被改写，则视为新的任务、标记自动失效。

export function normalizeCompletedLine(line: string): string {
  return line.trim();
}

export function completedLineSet(lines: Iterable<string>): Set<string> {
  const set = new Set<string>();
  for (const line of lines) {
    const key = normalizeCompletedLine(line);
    if (key) set.add(key);
  }
  return set;
}

export function isCompletedLine(line: string, completed: Set<string>): boolean {
  const key = normalizeCompletedLine(line);
  return Boolean(key) && completed.has(key);
}

/** 返回与当前选区（光标）相交的、非空的行文本。 */
export function lineKeysInSelection(
  content: string,
  selectionStart: number,
  selectionEnd: number,
): string[] {
  if (!content) return [];
  const start = Math.max(0, Math.min(selectionStart, content.length));
  const end = Math.max(start, Math.min(selectionEnd, content.length));
  const from = content.lastIndexOf("\n", Math.max(0, start - 1)) + 1;

  // 选区恰好停在下一行行首（末尾字符是换行符）时，不把下一行算进来
  const to =
    end > start && content[end - 1] === "\n"
      ? end - 1
      : (() => {
          const nextBreak = content.indexOf("\n", end);
          return nextBreak === -1 ? content.length : nextBreak;
        })();

  return content
    .slice(from, to)
    .split("\n")
    .map((line) => normalizeCompletedLine(line))
    .filter(Boolean);
}

/** 对一组行切换完成状态：全部已完成则取消，否则全部标记完成。 */
export function toggleCompletedLines(current: string[], keys: string[]): string[] {
  const set = new Set(current);
  const targets: string[] = [];
  for (const key of keys) {
    const normalized = normalizeCompletedLine(key);
    if (normalized && !targets.includes(normalized)) targets.push(normalized);
  }
  if (targets.length === 0) return current;

  const allCompleted = targets.every((key) => set.has(key));
  for (const key of targets) {
    if (allCompleted) set.delete(key);
    else set.add(key);
  }
  return Array.from(set);
}

/** 只保留仍然出现在正文里的标记，用于保存时顺手清理过期条目。 */
export function pruneCompletedLines(lines: string[], content: string): string[] {
  if (lines.length === 0) return lines;
  const present = completedLineSet(content.split("\n"));
  return lines.filter((line) => present.has(normalizeCompletedLine(line)));
}

const MARKDOWN_BLOCK_PREFIX =
  /^(\s*(?:(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?|#{1,6}\s+|>\s*)?)([\s\S]*?)(\s*)$/;

/**
 * 磁贴开启 Markdown 渲染时，用 GFM 删除线语法让已完成的行照样显示删除线。
 * 只包裹行内正文，保留列表符号 / 标题 / 引用前缀，避免破坏 Markdown 结构。
 */
export function strikeCompletedMarkdownLines(
  content: string,
  completed: Set<string>,
): string {
  if (completed.size === 0 || !content) return content;
  return content
    .split("\n")
    .map((line) => {
      if (!isCompletedLine(line, completed)) return line;
      const match = MARKDOWN_BLOCK_PREFIX.exec(line);
      if (!match) return line;
      const [, prefix, body, trailing] = match;
      if (!body.trim()) return line;
      return `${prefix}~~${body}~~${trailing}`;
    })
    .join("\n");
}
