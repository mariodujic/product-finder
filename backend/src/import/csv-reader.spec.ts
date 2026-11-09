import { CsvStructureError, readCsv } from './csv-reader';

const HEADER =
  'sku,name,chemical_name,function,application_area,region,certifications,status,launch_year,description';

describe('readCsv', () => {
  it('keeps quoted commas and escaped quotes inside a field', () => {
    const csv = `${HEADER}\nP-1,A,Chem,F,Area,EMEA,,Active,2020,"Light, non-greasy; ""high-solids"" systems"\n`;
    const [row] = readCsv(csv);
    expect(row.values.description).toBe(
      'Light, non-greasy; "high-solids" systems',
    );
    expect(row.values.region).toBe('EMEA');
  });

  it('reports 1-based line numbers (header is line 1)', () => {
    const csv = `${HEADER}\nP-1,A,C,F,Ar,R,,Active,2020,D\nP-2,B,C,F,Ar,R,,Active,2020,D\n`;
    expect(readCsv(csv).map((r) => r.line)).toEqual([2, 3]);
  });

  it('strips a UTF-8 BOM and tolerates header case, whitespace and column order', () => {
    const csv =
      '﻿ Name ,SKU,chemical_name,function,application_area,region,certifications,status,launch_year,description,extra\n' +
      'Alpha,P-1,C,F,Ar,R,,Active,2020,D,ignored\n';
    const [row] = readCsv(csv);
    expect(row.values.sku).toBe('P-1');
    expect(row.values.name).toBe('Alpha');
  });

  it('rejects an export with missing columns', () => {
    expect(() => readCsv('sku,name\nP-1,A\n')).toThrow(
      new CsvStructureError(
        'CSV is missing required column(s): chemical_name, function, application_area, region, certifications, status, launch_year, description',
      ),
    );
  });

  it('rejects a ragged export instead of guessing column alignment', () => {
    const csv = `${HEADER}\nP-1,A,C,F,Ar,R,,Active,2020\n`;
    expect(() => readCsv(csv)).toThrow(CsvStructureError);
  });

  it('rejects an empty file', () => {
    expect(() => readCsv('')).toThrow('CSV is empty');
  });
});
