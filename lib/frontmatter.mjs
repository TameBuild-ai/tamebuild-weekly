// Front matter for hand-written content.
//
// Deliberately not YAML. An editorial is written by hand (or committed by
// Claude from a chat), so the format is one "key: value" per line between two
// "---" lines, and nothing else. A value may be wrapped in quotes; "true" and
// "false" become booleans. Anything that does not fit throws, so a typo fails
// the build instead of publishing a page with a missing byline.

export function parseFrontMatter(src, file = "content") {
  const text = src.replace(/^﻿/, "");
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { data: {}, body: text };

  const data = {};
  m[1].split(/\r?\n/).forEach((line, i) => {
    if (!line.trim() || line.trim().startsWith("#")) return;
    const at = line.indexOf(":");
    if (at < 1) throw new Error(`${file}: front matter line ${i + 2} is not "key: value": ${line}`);
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    if (!/^[a-z_]+$/.test(key)) throw new Error(`${file}: front matter key "${key}" should be lowercase letters and underscores`);
    if (value.length >= 2 && /^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    else if (value === "true") value = true;
    else if (value === "false") value = false;
    data[key] = value;
  });
  return { data, body: text.slice(m[0].length) };
}
