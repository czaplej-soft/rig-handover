export type RunStatus = 'ok' | 'retry' | 'fail';

// One job's night. `runs` counts every log line for the job, retries and fails included.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  fails: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type Night = {
  rows: DigestRow[]; // sorted by job, so every reader of a night sees one order
  badLines: number;
};

// Lives in ./read.ts. null: the night has no file. An empty file gives zero rows.
export type ReadNight = (runsDir: string, night: string) => Night | null;
