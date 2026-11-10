import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const route = readFileSync(resolve(process.cwd(), 'app/api/account/profile/route.ts'), 'utf8');
const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261101073156_account_profile_update.sql'), 'utf8');
const usernameMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261110050000_coursepulse_username_auth.sql'), 'utf8');
const http = readFileSync(resolve(process.cwd(), 'lib/http.ts'), 'utf8');

describe('account profile update boundary', () => {
  it('updates only the active account name and derives the user id from authentication', () => {
    expect(route).toContain("getCurrentUser(supabase)");
    expect(route).toContain(".update(parsed.data)");
    expect(route).toContain(".eq('id', auth.user.id)");
    expect(route).not.toContain('user_id');
    expect(route).not.toContain('role:');
  });

  it('validates a strict display-name payload and applies same-origin protection', () => {
    expect(route).toContain("z.object({");
    expect(route).toContain("full_name: z.string().trim().min(2).max(100).optional()");
    expect(route).toContain("username: z.string().trim().toLowerCase().regex(");
    expect(route).toContain(".strict()");
    expect(route).toContain("'account:profile-update', 10, 3600");
    expect(http).toContain("'account:profile-update'");
  });

  it('grants only display-name and username columns and retains the own-row RLS policy', () => {
    expect(migration).toContain('grant update (full_name) on public.users to authenticated');
    expect(usernameMigration).toContain('grant update (username) on public.users to authenticated');
    expect(usernameMigration).toContain('create unique index if not exists users_username_unique');
    expect(migration).toContain("p_action not in (");
    expect(migration).toContain("'account:profile-update'");
    expect(migration).not.toMatch(/grant update on public\.users/i);
    expect(migration).not.toMatch(/disable row level security/i);
  });
});
