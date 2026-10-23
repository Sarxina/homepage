// The OBS plugins, read from their repository: each plugin's name and blurb from the README, and its newest release
// for the download. A plugin shows up here once it is in the README and has a release.
//
// The README names a plugin in one of two ways:
// - a row of its plugin table, `| **Name** | what it is | what it does |`, released as `<name-with-hyphens>-v...`
//   ("Sarxina Noise Gate" is `sarxina-noise-gate-v1.0.0`);
// - a section of its own, `## Name` with a line of text under it, released as `<name>-v...` as written.

export type Tool = { name: string; kind: string; blurb: string; url: string; action: string };

type Release = { tag_name: string; html_url: string; draft: boolean; prerelease: boolean };

// A table cell as plain text: no bold, code or link markup.
function plain(markdown: string) {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|`)/g, '')
    .trim();
}

// The first two sentences of a description, so that a long one stays one short paragraph on the shelf.
function firstSentences(text: string, count = 2) {
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z"(])/);
  return sentences.slice(0, count).join(' ');
}

export async function obsPlugins(repo: string): Promise<Tool[]> {
  const [readme, releases] = await Promise.all([
    fetch(`https://raw.githubusercontent.com/${repo}/HEAD/README.md`).then((r) => {
      if (!r.ok) throw new Error(`README: ${r.status}`);
      return r.text();
    }),
    fetch(`https://api.github.com/repos/${repo}/releases?per_page=100`).then((r) => {
      if (!r.ok) throw new Error(`releases: ${r.status}`);
      return r.json() as Promise<Release[]>;
    }),
  ]);

  // GitHub lists releases newest first
  const newest = (tagStart: string) =>
    releases.find((r) => !r.draft && !r.prerelease && r.tag_name.toLowerCase().startsWith(tagStart));

  const named: { name: string; blurb: string; tag: string }[] = [];
  for (const [, name, does] of readme.matchAll(/^\|\s*\*\*(.+?)\*\*\s*\|[^|\r\n]*\|\s*(.*?)\s*\|\s*$/gm)) {
    named.push({ name: name.trim(), blurb: firstSentences(plain(does)), tag: `${name.trim().toLowerCase().replace(/\s+/g, '-')}-v` });
  }
  // "## Name", a blank line, then the first line of text under it
  for (const [, name, blurb] of readme.matchAll(/^## (.+)\r?\n\s*\r?\n([^\r\n#!|].*)$/gm)) {
    named.push({ name: name.trim(), blurb: plain(blurb), tag: `${name.trim().toLowerCase()}-v` });
  }

  const plugins: Tool[] = [];
  for (const { name, blurb, tag } of named) {
    if (plugins.some((p) => p.name.toLowerCase() === name.toLowerCase())) continue;
    const release = newest(tag);
    if (release) plugins.push({ name, kind: 'OBS plugin', blurb, url: release.html_url, action: 'Download' });
  }
  return plugins;
}
