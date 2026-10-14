// The OBS plugins, read from their repository: each plugin's name and blurb from its section of the README, and its
// newest release for the download. A plugin shows up here once it has a README section and a release.

export type Tool = { name: string; kind: string; blurb: string; url: string; action: string };

type Release = { tag_name: string; html_url: string; draft: boolean; prerelease: boolean };

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

  const plugins: Tool[] = [];
  // "## Name", a blank line, then the first line of text under it
  for (const [, name, blurb] of readme.matchAll(/^## (.+)\r?\n\s*\r?\n([^\r\n#!].*)$/gm)) {
    // GitHub lists releases newest first
    const release = releases.find(
      (r) => !r.draft && !r.prerelease && r.tag_name.toLowerCase().startsWith(`${name.trim().toLowerCase()}-v`),
    );
    if (release) plugins.push({ name: name.trim(), kind: 'OBS plugin', blurb: blurb.trim(), url: release.html_url, action: 'Download' });
  }
  return plugins;
}
