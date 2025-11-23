import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { BranchOffice, BranchInvite } from '../types';
import {
  Building2,
  MapPin,
  Plus,
  Loader2,
  Sparkles,
  Globe,
  X,
  Copy,
  User,
} from '../components/ui/Icons';
import {
  createBranchInvite,
  fetchBranchInvites,
} from '../services/organizationService';

const OfficeManager: React.FC = () => {
  const { organization } = useAuth();
  const [offices, setOffices] = useState<BranchOffice[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    identifier: '',
    location: '',
    headcount: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedOffice, setSelectedOffice] = useState<BranchOffice | null>(null);
  const [adminInvites, setAdminInvites] = useState<BranchInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);

  const fetchOffices = async () => {
    if (!organization) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('branch_offices')
      .select('*')
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setOffices((data as BranchOffice[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOffices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  useEffect(() => {
    const loadInvites = async () => {
      if (!selectedOffice) return;
      setInvitesLoading(true);
      setInviteError(null);
      try {
        const data = await fetchBranchInvites(selectedOffice.id, 'branch_admin');
        setAdminInvites(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to load branch admins.';
        setInviteError(message);
      } finally {
        setInvitesLoading(false);
      }
    };
    loadInvites();
  }, [selectedOffice]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!organization) return;
    if (!form.identifier.trim() || !form.location.trim()) {
      setError('Branch identifier and location are required.');
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);
    const { error: insertError } = await supabase.from('branch_offices').insert({
      organization_id: organization.id,
      identifier: form.identifier.trim(),
      location: form.location.trim(),
      headcount: form.headcount ? Number(form.headcount) : 0,
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setSuccess('Branch office added to your network.');
      setForm({ identifier: '', location: '', headcount: '' });
      fetchOffices();
    }
    setCreating(false);
  };

  const stats = useMemo(() => {
    const byRegion = offices.reduce<Record<string, number>>((acc, office) => {
      const region =
        office.location.split(',').pop()?.trim() || office.location.trim();
      acc[region] = (acc[region] || 0) + 1;
      return acc;
    }, {});
    return {
      total: offices.length,
      regions: Object.keys(byRegion).length,
      busiest: Object.entries(byRegion)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2),
    };
  }, [offices]);

  const handleOpenOffice = (office: BranchOffice) => {
    setSelectedOffice(office);
    setInviteEmail('');
    setInviteLink(null);
  };

  const handleCreateInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!organization || !selectedOffice) return;
    if (!inviteEmail) {
      setInviteError('Email is required to invite an admin.');
      return;
    }
    setCreatingInvite(true);
    setInviteError(null);
    setInviteLink(null);
    try {
      const token = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
      await createBranchInvite({
        organizationId: organization.id,
        branchOfficeId: selectedOffice.id,
        email: inviteEmail.trim().toLowerCase(),
        inviteToken: token,
        role: 'branch_admin',
      });
      const link = `${window.location.origin}/#/invite/${token}`;
      setInviteLink(link);
      setInviteEmail('');

      try {
        await supabase.functions.invoke('send-branch-invite', {
          body: {
            email: inviteEmail.trim().toLowerCase(),
            inviteLink: link,
            branchIdentifier: selectedOffice.identifier,
            organizationName: organization.name,
          },
        });
      } catch (fnError) {
        console.error('Failed to send invite email', fnError);
        setInviteError(
          'Invite saved, but email delivery failed. Copy the link below and share it manually.'
        );
      }

      const data = await fetchBranchInvites(selectedOffice.id, 'branch_admin');
      setAdminInvites(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to create invite.';
      setInviteError(message);
    } finally {
      setCreatingInvite(false);
    }
  };

  return (
    <div className="p-10 min-h-screen bg-gradient-to-br from-[#020617] via-slate-900 to-slate-950 text-slate-100">
      <div className="flex flex-col lg:flex-row gap-8 mb-10">
        <div className="flex-1 bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-3xl shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-xs uppercase tracking-[0.5em] text-white/40">
                Branch Network
              </p>
              <h1 className="text-4xl font-bold font-['Outfit'] mt-2">
                Operational Geography
              </h1>
            </div>
            <span className="w-16 h-16 rounded-2xl bg-brand/20 text-brand flex items-center justify-center">
              <Building2 size={28} />
            </span>
          </div>
          <p className="text-white/70 leading-relaxed text-sm">
            Deploy new offices to expand service coverage, align regional legal
            teams, and control risk posture centrally. Each branch inherits your
            brand system, clause library, and AI guardrails.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.4em] text-white/40">
                Offices
              </p>
              <p className="text-3xl font-semibold mt-3">
                {stats.total.toString().padStart(2, '0')}
              </p>
              <p className="text-[11px] text-white/50 mt-1">
                Active across your network
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.4em] text-white/40">
                Regions
              </p>
              <p className="text-3xl font-semibold mt-3">
                {stats.regions.toString().padStart(2, '0')}
              </p>
              <p className="text-[11px] text-white/50 mt-1">
                Distinct HQ geographies
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.4em] text-white/40">
                Busiest
              </p>
              <div className="mt-2 space-y-1 text-sm">
                {stats.busiest.map(([region, count]) => (
                  <div key={region} className="flex items-center justify-between">
                    <span>{region}</span>
                    <span className="text-xs text-white/50">{count} offices</span>
                  </div>
                ))}
                {stats.busiest.length === 0 && (
                  <p className="text-white/50 text-xs">No offices yet</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleCreate}
          className="w-full lg:w-[420px] bg-white text-slate-900 rounded-3xl shadow-2xl p-8 space-y-6 border border-slate-100"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
                Launch branch
              </p>
              <h2 className="text-2xl font-bold mt-1">Create Office</h2>
            </div>
            <span className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center">
              <Sparkles size={22} />
            </span>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-2xl">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm p-4 rounded-2xl">
              {success}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-[0.4em] text-slate-500">
              Branch Identifier
            </label>
            <input
              type="text"
              value={form.identifier}
              onChange={(e) => setForm({ ...form, identifier: e.target.value })}
              placeholder="e.g. NYC-Legal-01"
              className="w-full p-4 rounded-2xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-[0.4em] text-slate-500 flex items-center gap-2">
              <MapPin size={14} className="text-brand" /> Location
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="City, Country"
              className="w-full p-4 rounded-2xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-[0.4em] text-slate-500">
              Headcount (optional)
            </label>
            <input
              type="number"
              min={0}
              value={form.headcount}
              onChange={(e) => setForm({ ...form, headcount: e.target.value })}
              placeholder="Approximate team size"
              className="w-full p-4 rounded-2xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-black transition disabled:opacity-60"
          >
            {creating ? (
              <>
                <Loader2 className="animate-spin" size={18} /> Deploying Branch
              </>
            ) : (
              <>
                <Plus size={18} /> Add Office
              </>
            )}
          </button>
        </form>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/40">
              Global map
            </p>
            <h3 className="text-2xl font-semibold">Active Branches</h3>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/70 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
            <Globe size={16} /> {organization?.name}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-white/60">
            <Loader2 className="animate-spin mb-4" size={32} />
            Loading branch data...
          </div>
        ) : offices.length === 0 ? (
          <div className="text-center py-16 text-white/60">
            <p className="text-lg font-semibold mb-2">No offices yet</p>
            <p className="text-sm">
              Use the panel above to seed your first regional branch.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {offices.map((office) => (
              <button
                key={office.id}
                onClick={() => handleOpenOffice(office)}
                className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-4 text-left hover:border-brand/50 hover:bg-white/10 transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-white/40">
                      Identifier
                    </p>
                    <p className="text-lg font-semibold">{office.identifier}</p>
                  </div>
                  <span className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                    <Building2 size={18} />
                  </span>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white/40">
                    Location
                  </p>
                  <p className="text-sm flex items-center gap-2">
                    <MapPin size={14} className="text-brand" /> {office.location}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs uppercase tracking-[0.3em] text-white/40">
                  <div>
                    <p>Headcount</p>
                    <p className="text-lg tracking-normal text-white font-semibold">
                      {office.headcount ?? 0}
                    </p>
                  </div>
                  <div>
                    <p>Created</p>
                    <p className="text-sm tracking-normal text-white font-medium">
                      {new Date(office.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white/40">
                    Location
                  </p>
                  <p className="text-sm flex items-center gap-2">
                    <MapPin size={14} className="text-brand" /> {office.location}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs uppercase tracking-[0.3em] text-white/40">
                  <div>
                    <p>Headcount</p>
                    <p className="text-lg tracking-normal text-white font-semibold">
                      {office.headcount ?? 0}
                    </p>
                  </div>
                  <div>
                    <p>Created</p>
                    <p className="text-sm tracking-normal text-white font-medium">
                      {new Date(office.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedOffice && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-8 relative">
            <button
              onClick={() => setSelectedOffice(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <div className="mb-6">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
                Branch Control
              </p>
              <h2 className="text-3xl font-bold text-slate-900">{selectedOffice.identifier}</h2>
              <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                <MapPin size={14} /> {selectedOffice.location}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <form onSubmit={handleCreateInvite} className="space-y-4 bg-slate-50 rounded-2xl p-5 border border-slate-200">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                    Create Branch Admin
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    Send an invitation link tied to this office.
                  </p>
                </div>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="admin@branch.com"
                  className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                  required
                />
                {inviteError && <p className="text-xs text-red-500">{inviteError}</p>}
                <button
                  type="submit"
                  disabled={creatingInvite}
                  className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {creatingInvite ? (
                    <>
                      <Loader2 className="animate-spin" size={16} /> Generating
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} /> Create Invite
                    </>
                  )}
                </button>
                {inviteLink && (
                  <div className="bg-white rounded-xl border border-slate-200 p-3 text-sm flex items-center justify-between gap-2">
                    <span className="truncate">{inviteLink}</span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(inviteLink)}
                      className="p-2 rounded-lg bg-slate-900 text-white text-xs flex items-center gap-1"
                    >
                      <Copy size={14} /> Copy
                    </button>
                  </div>
                )}
              </form>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                      Branch Admins
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      Pending & active users for this office.
                    </p>
                  </div>
                </div>
                {invitesLoading ? (
                  <div className="flex items-center justify-center py-10 text-slate-500">
                    <Loader2 className="animate-spin" size={24} />
                  </div>
                ) : adminInvites.length === 0 ? (
                  <p className="text-sm text-slate-500">No admins yet. Send an invite to get started.</p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {adminInvites.map((invite) => (
                      <div
                        key={invite.id}
                        className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                            <User size={16} className="text-brand" /> {invite.email}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {invite.status === 'accepted'
                              ? `Activated ${invite.accepted_at ? new Date(invite.accepted_at).toLocaleDateString() : ''}`
                              : `Invited ${new Date(invite.created_at).toLocaleDateString()}`}
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
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficeManager;


