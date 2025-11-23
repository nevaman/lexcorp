import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  createBranchUserAccount,
  fetchBranchUsersForOffice,
} from '../services/branchUserService';
import { BranchInvite } from '../types';
import {
  Loader2,
  Plus,
  Sparkles,
  User,
  Mail,
  Briefcase,
  Copy,
} from '../components/ui/Icons';
import { supabase } from '../services/supabaseClient';

const BranchUserManager: React.FC = () => {
  const { organization, branchOfficeId } = useAuth();
  const [people, setPeople] = useState<BranchInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    department: '',
    title: '',
    email: '',
  });

  const loadPeople = async () => {
    if (!branchOfficeId) {
      setPeople([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBranchUsersForOffice(branchOfficeId);
      setPeople(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load accounts.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPeople();
  }, [branchOfficeId]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!organization || !branchOfficeId) return;
    if (!form.fullName.trim() || !form.department.trim() || !form.email.trim()) {
      setError('Name, department, and email are required.');
      return;
    }
    setCreating(true);
    setError(null);
    setSuccess(null);
    setInviteLink(null);
    try {
      const token =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      await createBranchUserAccount({
        organizationId: organization.id,
        branchOfficeId,
        email: form.email.trim(),
        inviteToken: token,
        fullName: form.fullName.trim(),
        department: form.department.trim(),
        title: form.title.trim() || undefined,
      });

      const link = `${window.location.origin}/#/invite/${token}`;
      setInviteLink(link);
      setSuccess('Account invite created. Share the link or copy it below.');
      setForm({ fullName: '', department: '', title: '', email: '' });

      try {
        await supabase.functions.invoke('send-branch-invite', {
          body: {
            email: form.email.trim().toLowerCase(),
            inviteLink: link,
            branchIdentifier: branchOfficeId,
            organizationName: organization.name,
            subject: `You're invited to ${organization.name}`,
            description: `You've been added to the ${form.department.trim()} department. Use the link below to set your password and access the branch workspace.`,
            roleLabel: 'Activate Account',
          },
        });
      } catch (fnError) {
        console.warn('Branch user invite email failed', fnError);
        setSuccess(
          'Invite created, but email failed. Copy the link below and share it manually.'
        );
      }

      loadPeople();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to create account.';
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  if (!branchOfficeId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-500 p-10 text-center">
        <Sparkles size={24} className="mb-3 text-slate-400" />
        <p className="text-lg font-semibold">
          Sign in as a branch admin to manage accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="p-10 min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white">
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/60">
              Branch Accounts
            </p>
            <h1 className="text-4xl font-bold font-['Outfit'] mt-2">
              Department Directory
            </h1>
            <p className="text-sm text-white/70 mt-2">
              Issue workspace access to your branch team and tag them by department.
            </p>
          </div>
          <div className="bg-white/10 rounded-2xl px-5 py-3 text-sm text-white/80 flex items-center gap-2 border border-white/10">
            <Briefcase size={16} className="text-brand" /> Branch ID: {branchOfficeId.slice(0, 8)}…
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <form
            onSubmit={handleCreate}
            className="bg-white text-slate-900 rounded-3xl shadow-xl p-8 space-y-4 border border-slate-100"
          >
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center">
                <Plus size={20} />
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
                  New Account
                </p>
                <h2 className="text-xl font-bold">Invite teammate</h2>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-2xl">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm p-3 rounded-2xl">
                {success}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-[0.4em] text-slate-500">
                Full Name
              </label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                placeholder="e.g. Dana Booker"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-[0.4em] text-slate-500 flex items-center gap-2">
                <Briefcase size={12} /> Department
              </label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                placeholder="e.g. Revenue Ops"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-[0.4em] text-slate-500">
                Title (optional)
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                placeholder="e.g. Senior Analyst"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-[0.4em] text-slate-500 flex items-center gap-2">
                <Mail size={12} /> Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                placeholder="user@company.com"
                required
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {creating ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> Sending Invite
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Invite Team Mate
                </>
              )}
            </button>

            {inviteLink && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-600 flex items-center justify-between gap-2">
                <span className="truncate">{inviteLink}</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(inviteLink)}
                  className="px-2 py-1 rounded-lg bg-slate-900 text-white flex items-center gap-1"
                >
                  <Copy size={12} /> Copy
                </button>
              </div>
            )}
          </form>

          <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/60">
                  Branch People
                </p>
                <p className="text-sm text-white/60">
                  {people.length} accounts ({people.filter(p => p.status === 'accepted').length} active)
                </p>
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-16 text-white/60">
                <Loader2 className="animate-spin" size={28} />
              </div>
            ) : people.length === 0 ? (
              <div className="text-center py-16 text-white/60">
                <p className="text-lg font-semibold mb-2">No branch teammates yet</p>
                <p className="text-sm">Invite the first member using the form on the left.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {people.map((invite) => (
                  <div
                    key={invite.id}
                    className="bg-white/10 border border-white/10 rounded-2xl p-4 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-semibold">
                          {invite.full_name || invite.email}
                        </p>
                        <p className="text-sm text-white/70 flex items-center gap-2">
                          <Briefcase size={14} className="text-brand" />
                          {invite.department || 'Unassigned'}
                          {invite.title && <>• {invite.title}</>}
                        </p>
                      </div>
                      <span
                        className={`text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                          invite.status === 'accepted'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {invite.status}
                      </span>
                    </div>
                    <p className="text-xs text-white/60 flex items-center gap-2">
                      <Mail size={12} /> {invite.email}
                    </p>
                    <p className="text-xs text-white/50">
                      {invite.status === 'accepted'
                        ? `Activated ${invite.accepted_at ? new Date(invite.accepted_at).toLocaleDateString() : ''}`
                        : `Invited ${new Date(invite.created_at).toLocaleDateString()}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BranchUserManager;

