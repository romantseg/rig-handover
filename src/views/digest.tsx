import type { DigestNight, DigestRow } from '../digest/types.js';

const dash = '—';

// A row is marked when it retried 3+ times or failed at all. The flag is text, not only color:
// pages are also read as plain text.
function isMarked(row: DigestRow): boolean {
  return row.retries >= 3 || row.fails >= 1;
}

export function DigestPage({ digest }: { digest: DigestNight }) {
  return (
    <>
      <h1>digest · {digest.night}</h1>
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>fails</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((row) => (
              <tr class={isMarked(row) ? 'warn' : undefined}>
                <td>
                  {row.job}
                  {isMarked(row) ? ' ⚠' : ''}
                </td>
                <td>{row.owner ?? dash}</td>
                <td>{row.runs}</td>
                <td>{row.retries}</td>
                <td>{row.fails}</td>
                <td>{row.lastStatus}</td>
                <td>{row.lastError || dash}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {digest.badLines > 0 && <p class="warn">{digest.badLines} line(s) didn't parse</p>}
    </>
  );
}

export function DigestMissing({ night }: { night: string }) {
  return (
    <>
      <h1>digest · {night}</h1>
      <p class="warn">no run log for {night}</p>
    </>
  );
}
