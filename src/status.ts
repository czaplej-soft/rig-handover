import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { lastBeat, type Beat } from './heartbeat.js';
import { readNight } from './digest/read.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightCounts[];
};

// counts: null when readNight can't read the night.
export type NightCounts = { night: string; counts: { ok: number; retry: number; fail: number } | null };

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => {
      const n = readNight(config.runsDir, night);
      if (!n) return { night, counts: null };
      let retry = 0, fail = 0, runs = 0;
      for (const r of n.rows) { retry += r.retries; fail += r.fails; runs += r.runs; }
      return { night, counts: { ok: runs - retry - fail, retry, fail } };
    }),
  };
}
