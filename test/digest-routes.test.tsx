import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestNight } from '../src/digest/types.js';

// Fixtures live in a temp dir; the repo's runs/ folder is read-only.
let runsDir: string;

type Line = { at: string; job: string; status: 'ok' | 'retry' | 'fail'; owner: string | null; error?: string };

const lines = (...rows: Line[]) => rows.map((row) => JSON.stringify(row)).join('\n') + '\n';

// Hono escapes text as HTML entities (' becomes &#39;). Compare what a reader sees.
const visible = (html: string) =>
  html
    .replaceAll('&#39;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');

const app = () =>
  createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));

  // Two good lines for b/job (retry, then ok), one good line for a/job (fail, no owner).
  writeFileSync(
    join(runsDir, '2026-10-01.jsonl'),
    lines(
      { at: '2026-10-01T01:00:00+01:00', job: 'b/job', status: 'retry', owner: 'rook', error: 'x' },
      { at: '2026-10-01T02:00:00+01:00', job: 'a/job', status: 'fail', owner: null, error: 'boom' },
      { at: '2026-10-01T03:00:00+01:00', job: 'b/job', status: 'ok', owner: 'rook' },
    ),
  );

  // Empty night: the file exists, nothing ran.
  writeFileSync(join(runsDir, '2026-10-02.jsonl'), '');

  // One good line and one broken line (cut off mid-object).
  writeFileSync(
    join(runsDir, '2026-10-03.jsonl'),
    lines({ at: '2026-10-03T00:30:00+01:00', job: 'a/job', status: 'ok', owner: 'rook' }) +
      '{"at":"2026-10-03T01:00:00+01:00","job":"a/j\n',
  );

  // No file for 2026-10-04.
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('digest page', () => {
  it('renders both jobs, a/job before b/job, with a dash for the null owner', async () => {
    const res = await app().request('/digest/2026-10-01');
    const html = visible(await res.text());
    expect(res.status).toBe(200);
    const a = html.indexOf('a/job');
    const b = html.indexOf('b/job');
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    expect(html).toContain('—');
  });

  it('returns 404 for a night with no file', async () => {
    const res = await app().request('/digest/2026-10-04');
    expect(res.status).toBe(404);
  });

  it('says "nothing ran" for an empty night', async () => {
    const res = await app().request('/digest/2026-10-02');
    expect(res.status).toBe(200);
    expect(visible(await res.text())).toContain('nothing ran');
  });

  it('renders a night with a bad line and says it did not parse', async () => {
    const res = await app().request('/digest/2026-10-03');
    const html = visible(await res.text());
    expect(res.status).toBe(200);
    expect(html).toContain('a/job');
    expect(html).toContain("didn't parse");
  });
});

describe('digest JSON', () => {
  it('returns the rows for 2026-10-01 with folded counts', async () => {
    const res = await app().request('/api/digest/2026-10-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestNight;
    expect(body.rows.map((r) => r.job)).toEqual(['a/job', 'b/job']);
    expect(body.rows[0].owner).toBeNull();
    expect(body.rows[0].fails).toBe(1);
    expect(body.rows[1].retries).toBe(1);
  });

  it('returns 404 for a night with no file', async () => {
    const res = await app().request('/api/digest/2026-10-04');
    expect(res.status).toBe(404);
  });

  it('returns no rows for an empty night', async () => {
    const res = await app().request('/api/digest/2026-10-02');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestNight;
    expect(body.rows).toEqual([]);
  });

  it('counts the bad line and keeps the good one', async () => {
    const res = await app().request('/api/digest/2026-10-03');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestNight;
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(1);
  });
});

describe('page and JSON agree', () => {
  it('lists every JSON job in the page, in the same order', async () => {
    const json = (await (await app().request('/api/digest/2026-10-01')).json()) as DigestNight;
    const html = visible(await (await app().request('/digest/2026-10-01')).text());
    const jobs = json.rows.map((r) => r.job);
    const positions = jobs.map((job) => html.indexOf(job));
    expect(jobs).toHaveLength(2);
    expect(positions.every((p) => p > -1)).toBe(true);
    expect(positions).toEqual([...positions].sort((x, y) => x - y));
  });
});
