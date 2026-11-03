import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/types.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28')!;
  const row = (job: string) => night.rows.find((r) => r.job === job)!;

  it('finds 5 jobs, sorted by job, and 1 bad line', () => {
    expect(night.night).toBe('2026-10-28');
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('folds retries into the last status and keeps the last error', () => {
    expect(row('fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      fails: 0,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('marks a failed job', () => {
    const backup = row('notes/backup');
    expect(backup.fails).toBe(1);
    expect(backup.lastStatus).toBe('fail');
    expect(backup.lastError).toBe('quota exceeded');
  });

  it('keeps a null owner', () => {
    expect(row('digest/render').owner).toBeNull();
    expect(row('digest/render')).not.toHaveProperty('lastError');
  });

  it('counts lane/sync without the truncated last line, offsets verbatim', () => {
    const sync = row('lane/sync');
    expect(sync.runs).toBe(8);
    expect(sync.retries).toBe(1);
    expect(sync.fails).toBe(0);
    expect(sync.lastStatus).toBe('ok');
    expect(sync.lastError).toBe('lock held');
    expect(sync.firstAt).toBe('2026-10-28T23:00:06+01:00');
    expect(sync.lastAt).toBe('2026-10-29T05:00:04+01:00');
  });
});

describe('readNight edges', () => {
  let dir: string | undefined;
  const tempRuns = () => (dir = mkdtempSync(join(tmpdir(), 'rig-runs-')));
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('returns null for a night with no file', () => {
    expect(readNight(tempRuns(), '2026-10-30')).toBeNull();
  });

  it('returns null for a night that is not YYYY-MM-DD', () => {
    const runs = tempRuns();
    writeFileSync(join(runs, 'evil.jsonl'), '');
    expect(readNight(runs, 'evil')).toBeNull();
    expect(readNight(runs, '../runs/2026-10-28')).toBeNull();
  });

  it('reads an empty file as nothing ran', () => {
    const runs = tempRuns();
    writeFileSync(join(runs, '2026-10-30.jsonl'), '');
    expect(readNight(runs, '2026-10-30')).toEqual({ night: '2026-10-30', rows: [], badLines: 0 });
  });

  it('counts lines that parse but fail validation, skips blank lines', () => {
    const runs = tempRuns();
    const lines = [
      '',
      '{"at":"2026-10-30T01:00:00+01:00","job":"a","status":"ok","owner":"rook"}',
      '   ',
      '{"at":"2026-10-30T01:00:00+01:00","job":"a","status":"done","owner":"rook"}',
      '{"at":"2026-10-30T01:00:00+01:00","job":"a","status":"ok","owner":7}',
      '{"at":"2026-10-30T01:00:00+01:00","job":"a","status":"ok","owner":null,"error":5}',
      '{"job":"a","status":"ok","owner":null}',
      '[1,2]',
      'null',
    ];
    writeFileSync(join(runs, '2026-10-30.jsonl'), lines.join('\r\n'));
    const night = readNight(runs, '2026-10-30')!;
    expect(night.badLines).toBe(6);
    expect(night.rows).toHaveLength(1);
    expect(night.rows[0]!.runs).toBe(1);
  });
});
