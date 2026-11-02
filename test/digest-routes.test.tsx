import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
const line = (at: string, job: string, status: string, owner: string | null = null, extra = '') =>
  JSON.stringify({ at, job, status, owner }).replace('}', `${extra}}`);
const write = (night: string, lines: string[]) => writeFileSync(join(dir, `${night}.jsonl`), lines.join('\n') + (lines.length ? '\n' : ''));

write('2026-02-01', [
  line('2026-02-01T01:00:00+01:00', 'zeta/job', 'ok', 'rook'),
  line('2026-02-01T01:01:00+01:00', 'alpha/job', 'ok'),
  line('2026-02-01T01:02:00+01:00', 'mid/job', 'fail', 'rook', ',"error":"boom"'),
]);
write('2026-02-02', []);
write('2026-02-03', [line('2026-02-03T01:00:00+01:00', 'good/job', 'ok', 'rook'), 'not json']);

const app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });

describe('GET /digest/:night', () => {
  it('lists the jobs sorted, marks fails as warn, renders null owner as a dash', async () => {
    const res = await app.request('/digest/2026-02-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<table');
    const at = ['alpha/job', 'mid/job', 'zeta/job'].map((j) => html.indexOf(j));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(html).toContain('warn');
    expect(html).toContain('—');
  });

  it('404s for a night with no file', async () => {
    expect((await app.request('/digest/2001-01-01')).status).toBe(404);
  });

  it('says nothing ran for an empty night', async () => {
    const res = await app.request('/digest/2026-02-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('renders good rows and reports a bad line', async () => {
    const res = await app.request('/digest/2026-02-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('good/job');
    expect(html).toContain('1 bad line(s) in the log');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns rows sorted by job', async () => {
    const res = await app.request('/api/digest/2026-02-01');
    const body = (await res.json()) as { rows: { job: string; owner: string | null; fails: number }[]; badLines: number };
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/job', 'mid/job', 'zeta/job']);
    expect(body.rows[0]!.owner).toBeNull();
    expect(body.rows[1]).toMatchObject({ fails: 1, lastStatus: 'fail', lastError: 'boom' });
  });

  it('404s with an error body for a night with no file', async () => {
    const res = await app.request('/api/digest/2001-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('gives empty rows for an empty night', async () => {
    const res = await app.request('/api/digest/2026-02-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ rows: [], badLines: 0 });
  });

  it('counts a bad line', async () => {
    const res = await app.request('/api/digest/2026-02-03');
    const body = (await res.json()) as { rows: unknown[]; badLines: number };
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(1);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const html = await (await app.request('/digest/2026-02-01')).text();
    const body = (await (await app.request('/api/digest/2026-02-01')).json()) as { rows: { job: string }[] };
    const jobs = body.rows.map((r) => r.job);
    expect(jobs.every((j) => html.includes(j))).toBe(true);
    expect(jobs.map((j) => html.indexOf(j))).toEqual([...jobs.map((j) => html.indexOf(j))].sort((a, b) => a - b));
  });
});
