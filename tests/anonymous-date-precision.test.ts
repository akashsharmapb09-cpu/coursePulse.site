import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration=readFileSync(resolve(process.cwd(),'supabase/migrations/20261031211344_coursepulse_anonymous_date_precision.sql'),'utf8');
const schema=readFileSync(resolve(process.cwd(),'prisma/schema.prisma'),'utf8');

describe('anonymous timestamp minimization',()=>{
  it('removes precise timestamps from anonymous answer storage',()=>{
    expect(migration).toMatch(/drop column if exists submitted_at/i);
    expect(migration).toMatch(/a\.received_on as submitted_on/);
    expect(migration).toMatch(/a\.received_on::timestamp/);
  });
  it('keeps only date-level receipt metadata in the Prisma contract',()=>{
    const model=schema.split('model AnonymousSubmission {')[1]?.split('}')[0]??'';
    expect(model).toMatch(/receivedOn DateTime/);
    expect(model).not.toMatch(/submittedAt/);
  });
});
