// Drops Markdown markers (headings, bold, bullets, backticks) so AI text reads as plain prose.
export function plainText(text: string | null | undefined) {
  if (!text) return ''
  return text
    .replace(/^#{1,6}\s+[^\n]*\n?/gm, (line) => (/^#{1,6}\s+summary\s*$/i.test(line.trim()) ? '' : line.replace(/^#{1,6}\s+/, '')))
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\s)[*_]([^*_\n]+)[*_](?=\s|$)/g, '$1$2')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
    .replace(/^summary:?\s+/i, '')
}
