export const DAY = 86_400_000;

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfMonth(t: number = Date.now()): number {
  const d = new Date(t);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const fd = (ts: number): string =>
  new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export const fdS = (ts: number): string =>
  new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric' });

/** Deterministic PRNG so the demo dataset is identical on every seed. */
export function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Next free integer id for a collection. */
export function uid(arr: { id: number }[]): number {
  let m = 0;
  (arr || []).forEach((x) => {
    if (x.id > m) m = x.id;
  });
  return m + 1;
}

/** Next reference in the S-00001 / P-00001 style. */
export function nextRef(prefix: string, arr: { ref: string }[]): string {
  let m = 0;
  arr.forEach((x) => {
    const n = parseInt(String(x.ref).split('-')[1], 10);
    if (n > m) m = n;
  });
  return prefix + '-' + String(m + 1).padStart(5, '0');
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function exportCSV(name: string, rows: (string | number)[][]): void {
  const csv = rows
    .map((r) => r.map((c) => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(','))
    .join('\n');
  const a = document.createElement('a');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
