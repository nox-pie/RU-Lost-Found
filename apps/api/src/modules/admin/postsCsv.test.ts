import { describe, expect, it } from 'vitest';
import { csvCell, postsCsv } from './postsCsv';

describe('csvCell', () => {
  it('quotes cells with commas, quotes or line breaks', () => {
    expect(csvCell('Library')).toBe('Library');
    expect(csvCell('Desk 4, near "B"')).toBe('"Desk 4, near ""B"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(2.5)).toBe('2.5');
  });

  it('keeps text that a spreadsheet would run as a formula as plain text', () => {
    for (const text of ['=1+1', '+1', '-1', '@SUM(A1)']) {
      expect(csvCell(text)).toBe(`'${text}`);
    }
    expect(csvCell(-1)).toBe('-1'); // numbers are numbers
  });
});

describe('postsCsv', () => {
  it('writes a header, one line per post and the days a return took', () => {
    const csv = postsCsv([
      {
        createdAt: new Date('2026-10-01T10:00:00Z'),
        type: 'FOUND',
        category: 'KEYS',
        title: 'Keys',
        place: null,
        location: 'Canteen',
        occurredOn: new Date('2026-10-01T00:00:00Z'),
        status: 'RESOLVED',
        closeReason: null,
        resolvedAt: new Date('2026-10-03T22:00:00Z'),
        heldAtSecurityDesk: true,
      },
    ]);

    expect(csv.startsWith('\uFEFFPosted on,Type,')).toBe(true);
    expect(csv.split('\r\n')[1]).toBe(
      '2026-10-01,FOUND,KEYS,Keys,,Canteen,2026-10-01,RESOLVED,,2026-10-03,2.5,yes',
    );
  });
});
