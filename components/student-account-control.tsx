'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Account = { name: string; username: string; program: string };

export function StudentAccountControl() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;

    // Use the single INITIAL_SESSION event as the source of truth. Calling getUser()
    // here as well races the subscription's own session read in WebKit.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (!user) {
        if (alive) {
          setAccount(null);
          setLoading(false);
        }
        return;
      }

      window.setTimeout(() => {
        void (async () => {
          const { data: profile } = await supabase
            .from('users')
            .select('full_name,username,program,role,is_active')
            .eq('id', user.id)
            .maybeSingle();

          if (!alive) return;
          if (!profile || profile.role !== 'STUDENT' || !profile.is_active) {
            await supabase.auth.signOut();
            if (alive) {
              setAccount(null);
              setLoading(false);
            }
            return;
          }

          setAccount({
            name: profile.full_name || String(user.user_metadata?.full_name || 'Student'),
            username: profile.username || String(user.user_metadata?.username || 'student'),
            program: profile.program || String(user.user_metadata?.program || 'Student')
          });
          setLoading(false);
        })();
      }, 0);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setAccount(null);
    setSigningOut(false);
    router.refresh();
  }

  if (loading) return <span className="text-xs font-semibold text-[#526158]" aria-label="Checking student account">Account</span>;

  if (!account) return <div className="flex items-center gap-2">
    <Link href="/login" className="inline-flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-semibold text-[#456052] hover:bg-[#eff5f0]">Sign in</Link>
    <Link href="/signup" className="inline-flex min-h-11 items-center rounded-xl bg-[#245b3e] px-4 py-2 text-sm font-bold text-white hover:bg-[#194b34]">Create account</Link>
  </div>;

  return <div className="flex items-center gap-2">
    <span className="hidden max-w-44 items-center gap-2 rounded-xl bg-[#edf5ef] px-3 py-2 text-xs font-semibold text-[#315f43] sm:inline-flex" title={`@${account.username} · ${account.program}`}>
      <UserRound size={15}/><span className="max-w-28 truncate">{account.name}</span><span className="text-[#718177]">· @{account.username}</span><span className="text-[#718177]">· {account.program}</span>
    </span>
    <button type="button" onClick={signOut} disabled={signingOut} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dce6de] bg-white px-3 py-2 text-xs font-bold text-[#456052] hover:bg-[#f4f8f5] disabled:opacity-60">
      <LogOut size={14}/>{signingOut ? 'Signing out' : 'Sign out'}
    </button>
  </div>;
}
