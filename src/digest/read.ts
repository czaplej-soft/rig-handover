import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunStatus } from './types.js';

type LogLine = { at: string; job: string; status: RunStatus; owner: string | null; error: string | null };

const STATUSES: readonly unknown[] = ['ok', 'retry', 'fail'];

function parseLine(line: string): LogLine | null {
  let v: unknown;
  try {
    v = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string' || !STATUSES.includes(o.status)) return null;
  return {
    at: o.at,
    job: o.job,
    status: o.status as RunStatus,
    owner: typeof o.owner === 'string' ? o.owner : null,
    error: typeof o.error === 'string' ? o.error : null,
  };
}

// The night comes from a URL: anything but a date never reaches the filesystem.
export const readNight: ReadNight = (runsDir, night) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }

  const rows = new Map<string, DigestRow>();
  let badLines = 0;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (!line) {
      badLines++;
      continue;
    }
    const row = rows.get(line.job) ?? {
      job: line.job,
      owner: line.owner,
      runs: 0,
      retries: 0,
      fails: 0,
      lastStatus: line.status,
      lastError: null,
      firstAt: line.at,
      lastAt: line.at,
    };
    row.owner = line.owner;
    row.runs++;
    if (line.status === 'retry') row.retries++;
    if (line.status === 'fail') row.fails++;
    row.lastStatus = line.status;
    row.lastError = line.error ?? row.lastError;
    row.lastAt = line.at;
    rows.set(line.job, row);
  }

  const result: Night = {
    rows: [...rows.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0)),
    badLines,
  };
  return result;
};
