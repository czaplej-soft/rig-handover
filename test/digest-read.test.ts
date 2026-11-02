import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

function runsDir(night: string, body: string) {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  writeFileSync(join(dir, `${night}.jsonl`), body);
  return dir;
}

describe('readNight', () => {
  it('reads the real night: 5 jobs, 1 bad line', () => {
    const night = readNight('runs', '2026-10-28')!;
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night.rows[1]).toEqual({
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
    expect(night.rows[0]!.owner).toBeNull();
    expect(night.rows[3]).toMatchObject({ fails: 1, lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('returns null for a night with no file, and for a night that is not a date', () => {
    expect(readNight('runs', '2001-01-01')).toBeNull();
    expect(readNight('runs', '../package')).toBeNull();
  });

  it('gives zero rows for an empty file', () => {
    expect(readNight(runsDir('2026-01-01', ''), '2026-01-01')).toEqual({ rows: [], badLines: 0 });
  });

  it('counts valid JSON of the wrong shape as a bad line, and skips blank lines', () => {
    const body = '{"at":"t","job":"a","status":"nope","owner":null}\n\n[1]\n{"at":"t","job":"a","status":"ok"}\n';
    const night = readNight(runsDir('2026-01-02', body), '2026-01-02')!;
    expect(night.badLines).toBe(2);
    expect(night.rows).toHaveLength(1);
    expect(night.rows[0]!.owner).toBeNull();
  });
});
