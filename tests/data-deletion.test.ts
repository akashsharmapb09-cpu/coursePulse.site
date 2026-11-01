import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';

const migration=readFileSync(resolve(process.cwd(),'supabase/migrations/20261101110000_data_deletion_requests.sql'),'utf8');
const userRoute=readFileSync(resolve(process.cwd(),'app/api/account/data-deletion/route.ts'),'utf8');
const adminRoute=readFileSync(resolve(process.cwd(),'app/api/admin/deletion-requests/route.ts'),'utf8');
const dashboard=readFileSync(resolve(process.cwd(),'components/dashboard.tsx'),'utf8');

describe('personal data deletion request workflow',()=>{
  it('stores no answer payload or copied account details and denies direct table access',()=>{
    expect(migration).toContain('create table private.data_deletion_requests');
    expect(migration).toContain('requester_id uuid references public.users(id) on delete set null');
    expect(migration).toContain('data_deletion_requests_deny_direct_access');
    expect(migration).toContain('revoke all on table private.data_deletion_requests from public,anon,authenticated,service_role');
    expect(migration).not.toMatch(/answers jsonb|student_id|ip_address|user_agent/i);
  });
  it('limits users to their own request and prevents multiple active requests',()=>{
    expect(migration).toContain('where r.requester_id=(select auth.uid())');
    expect(migration).toContain('data_deletion_one_active_per_user');
    expect(migration).toContain("status in ('PENDING','IN_REVIEW','APPROVED')");
    expect(userRoute).toContain("rpc('get_my_data_deletion_requests')");
    expect(userRoute).toContain("rpc('create_my_data_deletion_request')");
    expect(userRoute).toContain("'account:deletion-request',2,86400");
  });
  it('restricts review to AAL2 administrators, legal transition path and audited resolution',()=>{
    expect(adminRoute).toContain("auth.profile.role!=='ADMIN'");
    expect(adminRoute).toContain("rpc('admin_review_data_deletion_request'");
    expect(migration).toContain("coalesce((select auth.jwt()->>'aal'),'aal1')<>'aal2'");
    expect(migration).toContain('Invalid deletion request status transition');
    expect(migration).toContain('private.admin_record_audit(');
    expect(migration).toContain("p_status='COMPLETED' and char_length(btrim(p_resolution_note))<12");
  });
  it('explains that request review is not automatic account deletion',()=>{
    expect(dashboard).toContain('Request account data deletion');
    expect(dashboard).toContain('Your requests');
    expect(dashboard).toContain('privileged Auth deletion credentials');
  });
});
