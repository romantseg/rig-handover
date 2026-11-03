// Plan morning-digest § 1. The contract every part of § 2 builds on: the reader (#2) fills
// it, the page, JSON and board (#3–#5) only read it.
//
// Input: runs/<night>.jsonl, one JSON object per line:
//   { "at": ISO time with offset, "job": string, "status": RunStatus, "owner": string | null, "error"?: string }

// Status of one run, as the log writes it.
export type RunStatus = 'ok' | 'retry' | 'fail';

// One job's night, folded from all of its lines. "Last" = the job's last line in file order.
export type DigestRow = {
  job: string; // as in the log, e.g. "lane/sync"
  owner: string | null; // owner on the job's last line; null stays null (views show "—")
  runs: number; // lines for this job, retries and fails included
  retries: number; // lines for this job with status "retry"
  lastStatus: RunStatus; // status on the job's last line
  lastError?: string; // most recent `error` seen for this job; absent if none had one
  firstAt: string; // `at` of the job's first line, verbatim (offset kept, never converted to UTC)
  lastAt: string; // `at` of the job's last line, verbatim
};

// What readNight returns for a night that has a file.
export type DigestNight = {
  night: string; // YYYY-MM-DD, as asked
  rows: DigestRow[]; // one per job, sorted by job; empty for an empty file ("nothing ran")
  badLines: number; // non-blank lines that didn't parse as a run; counted, never thrown
};

// Reads runsDir/<night>.jsonl. Returns null when there is no such file, or when `night` isn't
// YYYY-MM-DD (so it can't name a path outside runsDir): routes turn null into 404.
// Throws only on real I/O errors other than a missing file.
export function readNight(runsDir: string, night: string): DigestNight | null {
  throw new Error('readNight: not implemented (#2)');
}
