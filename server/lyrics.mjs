/** LRC text -> timed lines; lines without a timestamp come through untimed. */
export function parseLrc(text) {
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const match = raw.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/);
    if (match) {
      const time = (Number(match[1]) * 60 + Number(match[2])) * 1000;
      lines.push({ time: Math.round(time), text: match[3] });
    } else if (raw.trim()) {
      lines.push({ text: raw.trim() });
    }
  }
  return lines;
}
