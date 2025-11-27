import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BranchOffice, Vendor, VendorDocument } from '../types';
import {
  Store,
  Loader2,
  Plus,
  MapPin,
  UploadCloud,
  Paperclip,
  Trash2,
  ShieldCheck,
} from '../components/ui/Icons';
import {
  fetchVendors,
  createVendor,
  updateVendorDocuments,
  uploadVendorDocument,
} from '../services/vendorService';
import { supabase } from '../services/supabaseClient';

const MAX_DOCUMENTS = 3;

type FormState = {
  name: string;
  tin: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  scope: 'organization' | 'branch';
  branchOfficeId: string;
};

const initialFormState = (scope: 'organization' | 'branch', branchOfficeId?: string | null): FormState => ({
  name: '',
  tin: '',
  contactEmail: '',
  contactPhone: '',
  notes: '',
  scope,
  branchOfficeId: branchOfficeId ?? '',
});

const VendorManager: React.FC = () => {
  const {
    organization,
    memberRole,
    branchOfficeId,
    isOrgAdmin,
    user,
  } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [uploadingVendorId, setUploadingVendorId] = useState<string | null>(null);
  const [offices, setOffices] = useState<BranchOffice[]>([]);
  const [scopeFilter, setScopeFilter] = useState<'all' | 'organization' | 'branch'>(
    isOrgAdmin ? 'all' : 'branch'
  );
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [form, setForm] = useState<FormState>(
    initialFormState(isOrgAdmin ? 'organization' : 'branch', branchOfficeId)
  );

  const branchLocked = memberRole === 'branch_admin' && !branchOfficeId;

  const loadBranches = async () => {
    if (!organization) return;
    let query = supabase
      .from('branch_offices')
      .select('id, identifier, location')
      .eq('organization_id', organization.id)
      .order('identifier', { ascending: true });

    if (!isOrgAdmin && branchOfficeId) {
      query = query.eq('id', branchOfficeId);
    }

    const { data, error: fetchError } = await query;
    if (!fetchError && data) {
      setOffices(data as BranchOffice[]);
    }
  };

  const determineBranchParam = () => {
    if (isOrgAdmin) {
      if (scopeFilter === 'branch') {
        return branchFilter === 'all' ? null : branchFilter;
      }
      return undefined;
    }
    return branchOfficeId ?? null;
  };

  const loadVendors = async () => {
    if (!organization) return;
    if (branchLocked) {
      setVendors([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVendors({
        organizationId: organization.id,
        branchOfficeId: determineBranchParam(),
        scope: isOrgAdmin ? scopeFilter : undefined,
      });
      setVendors(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load vendors.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOrgAdmin, organization?.id, branchOfficeId]);

  useEffect(() => {
    loadVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, scopeFilter, branchFilter, branchOfficeId, memberRole]);

  useEffect(() => {
    if (!isOrgAdmin) {
      setForm((prev) => ({
        ...prev,
        scope: 'branch',
        branchOfficeId: branchOfficeId ?? '',
      }));
    }
  }, [branchOfficeId, isOrgAdmin]);

  const stats = useMemo(() => {
    const total = vendors.length;
    const branchScoped = vendors.filter((v) => !!v.branch_office_id).length;
    const withDocs = vendors.filter((v) => v.documents?.length).length;
    return {
      total,
      branchScoped,
      withDocs,
    };
  }, [vendors]);

  const handleCreateVendor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!organization) return;
    if (!form.name.trim() || !form.tin.trim()) {
      setError('Vendor name and TIN are required.');
      return;
    }
    if (form.scope === 'branch' && !(form.branchOfficeId || branchOfficeId)) {
      setError('Select a branch to assign this vendor.');
      return;
    }
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const branchAssignment = isOrgAdmin
        ? form.scope === 'organization'
          ? null
          : form.branchOfficeId || null
        : branchOfficeId;
      const newVendor = await createVendor({
        organizationId: organization.id,
        branchOfficeId: branchAssignment ?? null,
        name: form.name.trim(),
        tin: form.tin.trim(),
        contactEmail: form.contactEmail.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        notes: form.notes.trim() || undefined,
        createdBy: user?.id,
      });
      setVendors((prev) => [newVendor, ...prev]);
      setSuccess('Vendor registered successfully.');
      setForm(initialFormState(form.scope, form.branchOfficeId));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to register vendor.';
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleUploadDocuments = async (
    vendor: Vendor,
    files: FileList | null
  ) => {
    if (!files || files.length === 0) return;
    if (vendor.documents.length + files.length > MAX_DOCUMENTS) {
      setDocError(`You can upload up to ${MAX_DOCUMENTS} files per vendor.`);
      return;
    }
    setUploadingVendorId(vendor.id);
    setDocError(null);
    try {
      const existingDocs = [...vendor.documents];
      for (const file of Array.from(files)) {
        const uploadResult = await uploadVendorDocument({
          vendorId: vendor.id,
          file,
        });
        const doc: VendorDocument = {
          id:
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : Math.random().toString(36).slice(2),
          name: file.name,
          url: uploadResult.url,
          uploaded_at: new Date().toISOString(),
          mime_type: file.type || null,
        };
        existingDocs.push(doc);
      }
      const updated = await updateVendorDocuments(vendor.id, existingDocs);
      setVendors((prev) =>
        prev.map((v) => (v.id === vendor.id ? updated : v))
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to upload documents.';
      setDocError(message);
    } finally {
      setUploadingVendorId(null);
    }
  };

  const handleRemoveDocument = async (vendor: Vendor, docId: string) => {
    setUploadingVendorId(vendor.id);
    setDocError(null);
    try {
      const updatedList = vendor.documents.filter((doc) => doc.id !== docId);
      const updated = await updateVendorDocuments(vendor.id, updatedList);
      setVendors((prev) =>
        prev.map((v) => (v.id === vendor.id ? updated : v))
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to remove document.';
      setDocError(message);
    } finally {
      setUploadingVendorId(null);
    }
  };

  if (!organization) {
    return null;
  }

  if (branchLocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-500 p-10 text-center">
        <Store size={36} className="mb-4 text-brand" />
        <p className="text-lg font-semibold">
          Assign this branch admin to a branch to manage vendors.
        </p>
      </div>
    );
  }

  return (
    <div className="p-10 min-h-screen bg-gradient-to-br from-[#030617] via-slate-900 to-slate-950 text-white">
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                Vendor Directory
              </p>
              <h1 className="text-4xl font-bold font-['Outfit'] mt-2">
                Compliant Partner Network
              </h1>
              <p className="text-sm text-white/60 mt-2">
                Register counterparties, store legal dossiers, and tag them per
                office.
              </p>
            </div>
            <span className="w-16 h-16 rounded-2xl bg-brand/20 text-brand flex items-center justify-center">
              <Store size={28} />
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="bg-white/5 rounded-2xl py-4 border border-white/10">
              <p className="text-[10px] uppercase tracking-[0.4em] text-white/50">
                Total
              </p>
              <p className="text-3xl font-bold">{stats.total}</p>
            </div>
            <div className="bg-white/5 rounded-2xl py-4 border border-white/10">
              <p className="text-[10px] uppercase tracking-[0.4em] text-white/50">
                Branch Scoped
              </p>
              <p className="text-3xl font-bold">{stats.branchScoped}</p>
            </div>
            <div className="bg-white/5 rounded-2xl py-4 border border-white/10">
              <p className="text-[10px] uppercase tracking-[0.4em] text-white/50">
                With Evidence
              </p>
              <p className="text-3xl font-bold">{stats.withDocs}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <form
            onSubmit={handleCreateVendor}
            className="bg-white text-slate-900 rounded-3xl shadow-xl p-8 space-y-4 border border-slate-100"
          >
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center">
                <Plus size={20} />
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
                  Register Vendor
                </p>
                <h2 className="text-xl font-bold">Counterparty Intake</h2>
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
                Vendor Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                placeholder="e.g. Atlas Suppliers"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-[0.4em] text-slate-500 flex items-center gap-2">
                <ShieldCheck size={12} /> TIN Number
              </label>
              <input
                type="text"
                value={form.tin}
                onChange={(e) => setForm({ ...form, tin: e.target.value })}
                className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                placeholder="Enter tax identification number"
                required
              />
            </div>

            {isOrgAdmin && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-[0.4em] text-slate-500">
                  Visibility
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 p-3 border rounded-xl flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="vendor-scope"
                      value="organization"
                      checked={form.scope === 'organization'}
                      onChange={() =>
                        setForm((prev) => ({ ...prev, scope: 'organization' }))
                      }
                    />
                    <span className="text-sm">Organization-wide</span>
                  </label>
                  <label className="flex-1 p-3 border rounded-xl flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="vendor-scope"
                      value="branch"
                      checked={form.scope === 'branch'}
                      onChange={() =>
                        setForm((prev) => ({ ...prev, scope: 'branch' }))
                      }
                    />
                    <span className="text-sm">Branch only</span>
                  </label>
                </div>
              </div>
            )}

            {(isOrgAdmin || branchOfficeId) && form.scope === 'branch' && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-[0.4em] text-slate-500 flex items-center gap-2">
                  <MapPin size={12} /> Assign Branch
                </label>
                <select
                  value={
                    isOrgAdmin
                      ? form.branchOfficeId
                      : branchOfficeId ?? form.branchOfficeId
                  }
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      branchOfficeId: e.target.value,
                    }))
                  }
                  className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none bg-white"
                >
                  <option value="">Select branch</option>
                  {(isOrgAdmin ? offices : offices.filter((o) => o.id === branchOfficeId)).map(
                    (office) => (
                      <option key={office.id} value={office.id}>
                        {office.identifier} • {office.location}
                      </option>
                    )
                  )}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-[0.4em] text-slate-500">
                Contact Email
              </label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) =>
                  setForm({ ...form, contactEmail: e.target.value })
                }
                className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                placeholder="legal@vendor.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-[0.4em] text-slate-500">
                Contact Phone
              </label>
              <input
                type="tel"
                value={form.contactPhone}
                onChange={(e) =>
                  setForm({ ...form, contactPhone: e.target.value })
                }
                className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                placeholder="+1 202 555 0101"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-[0.4em] text-slate-500">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                placeholder="Risk profile, payment cadence, etc."
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {creating ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> Saving
                </>
              ) : (
                <>
                  <Plus size={16} /> Register Vendor
                </>
              )}
            </button>
          </form>

          <div className="xl:col-span-2 bg-white/5 border border-white/10 rounded-3xl p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/60">
                  Vendor Records
                </p>
                <p className="text-sm text-white/60">
                  {vendors.length} vendors loaded
                </p>
              </div>
              {isOrgAdmin && (
                <div className="flex items-center gap-3 text-sm">
                  <select
                    value={scopeFilter}
                    onChange={(e) =>
                      setScopeFilter(e.target.value as typeof scopeFilter)
                    }
                    className="bg-white/10 text-white px-3 py-2 rounded-xl border border-white/10"
                  >
                    <option value="all">All vendors</option>
                    <option value="organization">Organization-wide</option>
                    <option value="branch">Branch-specific</option>
                  </select>
                  {scopeFilter === 'branch' && (
                    <select
                      value={branchFilter}
                      onChange={(e) => setBranchFilter(e.target.value)}
                      className="bg-white/10 text-white px-3 py-2 rounded-xl border border-white/10"
                    >
                      <option value="all">All branches</option>
                      {offices.map((office) => (
                        <option key={office.id} value={office.id}>
                          {office.identifier}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            {docError && (
              <div className="mb-4 text-sm text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-2">
                {docError}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-24 text-white/70">
                <Loader2 className="animate-spin" size={32} />
              </div>
            ) : vendors.length === 0 ? (
              <div className="text-center py-24 text-white/70">
                <p className="text-lg font-semibold mb-2">
                  No vendors registered yet
                </p>
                <p className="text-sm">
                  Use the form on the left to create your first vendor record.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {vendors.map((vendor) => (
                  <div
                    key={vendor.id}
                    className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <p className="text-xl font-semibold">
                          {vendor.name}
                        </p>
                        <p className="text-sm text-white/60">
                          TIN: {vendor.tin}
                        </p>
                        <p className="text-xs text-white/50 mt-1 flex items-center gap-1">
                          <MapPin size={12} className="text-brand" />
                          {vendor.branch_office_id
                            ? offices.find((o) => o.id === vendor.branch_office_id)?.identifier ||
                              'Branch vendor'
                            : 'Organization-wide'}
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-white/80 text-sm cursor-pointer hover:bg-white/5">
                        <UploadCloud size={16} />
                        Upload Legal Docs
                        <input
                          type="file"
                          multiple
                          hidden
                          onChange={(e) =>
                            handleUploadDocuments(vendor, e.target.files)
                          }
                          disabled={
                            uploadingVendorId === vendor.id ||
                            vendor.documents.length >= MAX_DOCUMENTS
                          }
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/70">
                      <p>
                        <span className="text-white/40 text-xs uppercase tracking-[0.3em]">
                          Email
                        </span>
                        <br />
                        {vendor.contact_email || '—'}
                      </p>
                      <p>
                        <span className="text-white/40 text-xs uppercase tracking-[0.3em]">
                          Phone
                        </span>
                        <br />
                        {vendor.contact_phone || '—'}
                      </p>
                    </div>
                    {vendor.notes && (
                      <p className="text-sm text-white/70 bg-white/5 border border-white/10 rounded-2xl p-3">
                        {vendor.notes}
                      </p>
                    )}
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                        Legal Documentation ({vendor.documents.length}/
                        {MAX_DOCUMENTS})
                      </p>
                      {vendor.documents.length === 0 ? (
                        <p className="text-sm text-white/50">
                          No files uploaded yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {vendor.documents.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <Paperclip size={14} />
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-white underline decoration-dotted"
                                >
                                  {doc.name}
                                </a>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveDocument(vendor, doc.id)}
                                className="text-white/50 hover:text-red-300"
                                disabled={uploadingVendorId === vendor.id}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {uploadingVendorId === vendor.id && (
                      <p className="text-xs text-white/60 flex items-center gap-2">
                        <Loader2 className="animate-spin" size={12} /> Updating
                        vendor files…
                      </p>
                    )}
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

export default VendorManager;

