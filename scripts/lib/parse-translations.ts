export type ParsedFilename = { id: string; file: string; title: string };

export function parseFilename(name: string): ParsedFilename | null {
  if (!name.endsWith(".md")) return null;

  const base = name.slice(0, -3);

  const match = base.match(/^(\d{2})(?:-(\d{2}))?\s+(.+)$/);
  if (!match) return null;

  const major = parseInt(match[1], 10);
  const minor = match[2] !== undefined ? parseInt(match[2], 10) : undefined;
  const title = match[3];

  const id = minor !== undefined ? `${major}-${minor}` : `${major}`;

  return { id, file: base, title };
}

export type ParsedGithubBase = {
  owner: string;
  repo: string;
  branch: string;
  pathPrefix: string;
};

export function parseGithubBase(url: string): ParsedGithubBase | null {
  const match = url.match(
    /raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+?)\/?$/
  );
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    branch: match[3],
    pathPrefix: match[4],
  };
}
