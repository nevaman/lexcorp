import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import {
  fetchInviteByToken,
  ensureMembership,
  markInviteAccepted,
} from '../services/organizationService';
import { Loader2, Sparkles } from '../components/ui/Icons';

interface BranchInviteProps {
  token: string;
}

const BranchInvite: React.FC<BranchInviteProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteDetails, setInviteDetails] = useState<Awaited<
    ReturnType<typeof fetchInviteByToken>
  > | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const loadInvite = async () => {
      setLoading(true);
      setInviteError(null);
      try {
        const invite = await fetchInviteByToken(token);
        if (!invite) {
          setInviteError('This invitation could not be found or has been revoked.');
        } else if (invite.status === 'accepted') {
          setInviteError('This invitation has already been accepted.');
        } else {
          setInviteDetails(invite);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to load invitation.';
        setInviteError(message);
      } finally {
        setLoading(false);
      }
    };

    loadInvite();
  }, [token]);

  const handleAccept = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inviteDetails) return;
    if (!password || password.length < 6) {
      setInviteError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setInviteError('Passwords do not match.');
      return;
    }
    setAccepting(true);
    setInviteError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: inviteDetails.email,
        password,
        options: {
          emailRedirectTo:
            typeof window !== 'undefined' ? window.location.origin : undefined,
          data: {
            role: inviteDetails.role,
            branchOfficeId: inviteDetails.branch_office_id,
            organizationId: inviteDetails.organization_id,
            department: inviteDetails.department || undefined,
          },
        },
      });
      if (error) throw error;
      const userId = data.user?.id;
      if (!userId) {
        throw new Error('Sign up succeeded but no user id returned.');
      }
      await ensureMembership({
        userId,
        organizationId: inviteDetails.organization_id,
        role: inviteDetails.role === 'branch_user' ? 'branch_user' : 'branch_admin',
        branchOfficeId: inviteDetails.branch_office_id,
        department: inviteDetails.department || null,
      });
      await markInviteAccepted(inviteDetails.id, userId);
      setSuccess(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to create account.';
      setInviteError(message);
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white/10 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-brand/20 text-brand flex items-center justify-center">
            <Sparkles size={22} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/60">
              Branch Access
            </p>
            <h1 className="text-2xl font-bold">Office Invitation</h1>
          </div>
        </div>

        {inviteError && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-200 text-sm p-4 rounded-2xl mb-4">
            {inviteError}
          </div>
        )}

        {!inviteDetails || success ? (
          <div className="space-y-4">
            {success ? (
              <>
                <p className="text-lg font-semibold">
                  Your account is ready!
                </p>
                <p className="text-sm text-white/70">
                  You can now sign in from the main portal using your email and the password you just set.
                </p>
                <button
                  onClick={() => {
                    window.location.hash = '#/signin';
                    window.location.reload();
                  }}
                  className="w-full bg-white text-slate-900 font-semibold py-3 rounded-xl"
                >
                  Go to Sign In
                </button>
              </>
            ) : (
              <p className="text-sm text-white/70">
                Nothing to show for this link. Please contact the organization manager
                for a new invite.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
              <p className="text-xs uppercase tracking-[0.4em] text-white/60">
                Organization
              </p>
              <p className="text-lg font-semibold">{inviteDetails.organizations.name}</p>
              <p className="text-sm text-white/60 mt-1">
                Office: {inviteDetails.branch_offices.identifier} (
                {inviteDetails.branch_offices.location})
              </p>
              <p className="text-sm text-white/60 mt-1">Invited email: {inviteDetails.email}</p>
              {inviteDetails.role === 'branch_user' && (
                <p className="text-sm text-white/60 mt-1">
                  Department: {inviteDetails.department || 'Unassigned'}
                  {inviteDetails.title && ` • ${inviteDetails.title}`}
                </p>
              )}
            </div>

            <form onSubmit={handleAccept} className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-[0.4em] text-white/60">
                  Set Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full mt-2 p-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:ring-2 focus:ring-brand"
                  placeholder="At least 6 characters"
                  required
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.4em] text-white/60">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full mt-2 p-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:ring-2 focus:ring-brand"
                  placeholder="Confirm password"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={accepting}
                className="w-full bg-white text-slate-900 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {accepting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> Creating account
                  </>
                ) : (
                  'Accept Invite'
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default BranchInvite;

