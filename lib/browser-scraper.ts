import { execSync, spawnSync } from 'child_process';
import { homedir } from 'os';
import { existsSync } from 'fs';

const BROWSE_BIN = `${homedir()}/.claude/skills/gstack/browse/dist/browse`;

function runBrowse(cmd: string, timeout = 15000): string {
  if (!existsSync(BROWSE_BIN)) throw new Error('Browse binary not found at ' + BROWSE_BIN);
  const raw = execSync(`"${BROWSE_BIN}" ${cmd}`, {
    timeout,
    encoding: 'utf8',
    env: { ...process.env, HOME: homedir() },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const match = raw.match(/--- BEGIN UNTRUSTED EXTERNAL C[^\n]+---\n([\s\S]*?)(?:--- END UNTRUSTED|$)/);
  return match ? match[1] : raw;
}

export function browserNavigate(url: string): void {
  runBrowse(`goto "${url}"`, 25000);
  try { runBrowse('wait --networkidle', 8000); } catch { /* timeout OK */ }
}

export function browserGetText(): string {
  return runBrowse('text', 15000);
}

export function browserGetLinks(): Array<{ text: string; href: string }> {
  const raw = runBrowse('links', 15000);
  const links: Array<{ text: string; href: string }> = [];
  for (const line of raw.split('\n')) {
    const m = line.match(/^(.+?)\s*→\s*(https?:\/\/.+)$/);
    if (m) links.push({ text: m[1].trim(), href: m[2].trim() });
  }
  return links;
}

export function browserGetCurrentHtml(): string {
  return runBrowse('html', 15000);
}

export function browserSleep(ms: number): void {
  spawnSync('sleep', [String(ms / 1000)], { timeout: ms + 2000 });
}

export function browserRunJS(expr: string): string {
  // Escape single quotes in the expression for shell safety
  const escaped = expr.replace(/'/g, `'"'"'`);
  return runBrowse(`js '${escaped}'`, 15000);
}

export function browserGetHtml(url: string): string {
  browserNavigate(url);
  return runBrowse('html', 10000);
}
