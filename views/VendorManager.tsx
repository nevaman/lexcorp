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
  Search,
  X,
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
  const [tableError, setTableError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [uploadingVendorId, setUploadingVendorId] = useState<string | null>(null);
  const [offices, setOffices] = useState<BranchOffice[]>([]);
  const [scopeFilter, setScopeFilter] = useState<'all' | 'organization' | 'branch'>(
    isOrgAdmin ? 'all' : 'branch'
  );
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(
    initialFormState(isOrgAdmin ? 'organization' : 'branch', branchOfficeId)
  );
  const openCreateModal = () => {
    setForm(initialFormState(isOrgAdmin ? 'organization' : 'branch', branchOfficeId));
    setFormError(null);
    setShowCreateModal(true);
  };
  const closeCreateModal = () => {
    setShowCreateModal(false);
    setFormError(null);
    setForm(initialFormState(isOrgAdmin ? 'organization' : 'branch', branchOfficeId));
  };

  const branchLocked = memberRole === 'branch_admin' && !branchOfficeId;

  const getOfficeLabel = (officeId?: string | null) => {
    if (!officeId) return 'Organization-wide';
    const office = offices.find((o) => o.id === officeId);
    return office ? `${office.identifier} • ${office.location}` : 'Assigned branch';
  };

  const filteredVendors = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return vendors;
    return vendors.filter((vendor) => {
      const officeLabel = getOfficeLabel(vendor.branch_office_id).toLowerCase();
      return (
        vendor.name.toLowerCase().includes(term) ||
        vendor.tin.toLowerCase().includes(term) ||
        (vendor.contact_email || '').toLowerCase().includes(term) ||
        officeLabel.includes(term)
      );
    });
  }, [vendors, searchTerm, offices]);

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
    setTableError(null);
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
      setTableError(message);
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
      setFormError('Vendor name and TIN are required.');
      return;
    }
    if (form.scope === 'branch' && !(form.branchOfficeId || branchOfficeId)) {
      setFormError('Select a branch to assign this vendor.');
      return;
    }
    setCreating(true);
    setFormError(null);
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
      setShowCreateModal(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to register vendor.';
      setFormError(message);
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
    <div className="p-10 min-h-screen bg-gradient-to-br from-[#020617] via-slate-900 to-slate-950 text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/50">
              Vendor Directory
            </p>
            <h1 className="text-4xl font-bold font-['Outfit'] mt-2">
              Compliant Partner Network
            </h1>
            <p className="text-sm text-white/60 mt-2 max-w-2xl">
              Operate with the same clarity as the overview dashboard: search, filter, and manage counterparties with a single glance.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={openCreateModal}
              className="bg-brand text-white px-6 py-3 rounded-2xl font-semibold shadow-lg shadow-brand/30 flex items-center gap-2"
            >
              <Plus size={16} /> New Vendor
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-5">
            <p className="text-[10px] uppercase tracking-[0.4em] text-white/50">
              Total Vendors
            </p>
            <p className="text-4xl font-bold mt-2">{stats.total}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-5">
            <p className="text-[10px] uppercase tracking-[0.4em] text-white/50">
              Branch Scoped
            </p>
            <p className="text-4xl font-bold mt-2">{stats.branchScoped}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-5">
            <p className="text-[10px] uppercase tracking-[0.4em] text-white/50">
              With Documentation
            </p>
            <p className="text-4xl font-bold mt-2">{stats.withDocs}</p>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border border-white/10">
          <div className="relative flex-1 w-full max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search vendors by name, TIN, branch…"
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-transparent text-sm text-white placeholder-white/40 focus:bg-white/10 focus:border-brand/40 outline-none transition-colors"
            />
          </div>
          {isOrgAdmin && (
            <div className="flex items-center gap-2 flex-wrap">
              {['all', 'organization', 'branch'].map((scope) => (
                <button
                  key={scope}
                  onClick={() => setScopeFilter(scope as typeof scopeFilter)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest ${
                    scopeFilter === scope
                      ? 'bg-brand text-white shadow-lg shadow-brand/30'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {scope === 'all'
                    ? 'All'
                    : scope === 'organization'
                    ? 'Org-wide'
                    : 'Branch'}
                </button>
              ))}
              {scopeFilter === 'branch' && (
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
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

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-200 text-sm px-4 py-3 rounded-2xl">
            {success}
          </div>
        )}
        {tableError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-200 text-sm px-4 py-3 rounded-2xl">
            {tableError}
          </div>
        )}
        {docError && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm px-4 py-3 rounded-2xl">
            {docError}
          </div>
        )}

        <div className="border border-white/5 rounded-3xl bg-white/5 backdrop-blur flex flex-col shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/60 text-[11px] uppercase tracking-[0.3em]">
                  <th className="px-8 py-4">Vendor</th>
                  <th className="px-6 py-4">TIN</th>
                  <th className="px-6 py-4">Scope</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Documents</th>
                  <th className="px-6 py-4">Created</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center">
                      <Loader2 className="animate-spin text-white/60" size={28} />
                    </td>
                  </tr>
                ) : filteredVendors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center text-white/60">
                      No vendors match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredVendors.map((vendor) => (
                    <tr key={vendor.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-8 py-5">
                        <p className="font-semibold text-white">{vendor.name}</p>
                        <p className="text-xs text-white/50 mt-1">{getOfficeLabel(vendor.branch_office_id)}</p>
                      </td>
                      <td className="px-6 py-5 text-white/70">{vendor.tin}</td>
                      <td className="px-6 py-5">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            vendor.branch_office_id
                              ? 'bg-blue-500/10 text-blue-200 border border-blue-500/40'
                              : 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/40'
                          }`}
                        >
                          {vendor.branch_office_id ? 'Branch' : 'Org'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-white/70">
                        <div>{vendor.contact_email || '—'}</div>
                        <div className="text-white/40 text-xs mt-1">{vendor.contact_phone || ''}</div>
                      </td>
                      <td className="px-6 py-5 text-white/70">
                        <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                          {vendor.documents.length}/{MAX_DOCUMENTS} files
                        </p>
                        {vendor.documents.length === 0 ? (
                          <p className="text-sm text-white/40 mt-1">Awaiting uploads</p>
                        ) : (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {vendor.documents.map((doc) => (
                              <span
                                key={doc.id}
                                className="inline-flex items-center gap-1 bg-white/10 border border-white/10 rounded-xl px-2 py-1 text-xs"
                              >
                                <Paperclip size={12} className="text-white/50" />
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline decoration-dotted"
                                >
                                  {doc.name}
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDocument(vendor, doc.id)}
                                  className="text-white/50 hover:text-red-300"
                                  disabled={uploadingVendorId === vendor.id}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5 text-white/60">
                        {new Date(vendor.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-white/80 text-xs cursor-pointer hover:bg-white/10">
                          <UploadCloud size={14} />
                          Upload
                          <input
                            type="file"
                            multiple
                            hidden
                            onChange={(e) => handleUploadDocuments(vendor, e.target.files)}
                            disabled={
                              uploadingVendorId === vendor.id ||
                              vendor.documents.length >= MAX_DOCUMENTS
                            }
                          />
                        </label>
                        {uploadingVendorId === vendor.id && (
                          <p className="text-[10px] text-white/50 mt-2 flex items-center gap-1">
                            <Loader2 className="animate-spin" size={12} /> Syncing…
                          </p>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-8 py-5 border-t border-white/5 flex items-center justify-between text-xs text-white/50">
            <p>
              Showing <span className="text-white font-bold">{filteredVendors.length}</span> records
            </p>
            <div className="flex gap-2">
              <button className="p-2 border border-white/10 rounded-lg text-white/40">
                ◀
              </button>
              <button className="p-2 border border-white/10 rounded-lg text-white/40">
                ▶
              </button>
            </div>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-[#0f172a] w-full max-w-2xl rounded-3xl p-8 relative border border-white/10">
            <button
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
              onClick={closeCreateModal}
            >
              <X size={18} />
            </button>
            <div className="mb-6">
              <p className="text-[11px] uppercase tracking-[0.4em] text-slate-400">Register Vendor</p>
              <h2 className="text-3xl font-bold text-white mt-2">Counterparty Intake</h2>
            </div>
            {formError && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-200 text-sm px-4 py-3 rounded-2xl mb-4">
                {formError}
              </div>
            )}
            <form onSubmit={handleCreateVendor} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.3em] text-white/60 flex items-center gap-2">
                    <Store size={12} /> Vendor Name
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full mt-2 p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-brand/50"
                    placeholder="Atlas Suppliers"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.3em] text-white/60 flex items-center gap-2">
                    <ShieldCheck size={12} /> TIN
                  </label>
                  <input
                    type="text"
                    value={form.tin}
                    onChange={(e) => setForm({ ...form, tin: e.target.value })}
                    className="w-full mt-2 p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-brand/50"
                    placeholder="Tax identification number"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.3em] text-white/60">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                    className="w-full mt-2 p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-brand/50"
                    placeholder="legal@vendor.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.3em] text-white/60">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    className="w-full mt-2 p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-brand/50"
                    placeholder="+1 202 555 0101"
                  />
                </div>
              </div>

              {isOrgAdmin && (
                <div className="flex gap-3">
                  <label className={`flex-1 p-3 rounded-2xl border ${form.scope === 'organization' ? 'border-brand bg-brand/10 text-white' : 'border-white/10 text-white/70'} cursor-pointer flex items-center gap-2`}>
                    <input
                      type="radio"
                      className="accent-brand"
                      name="modal-scope"
                      value="organization"
                      checked={form.scope === 'organization'}
                      onChange={() => setForm((prev) => ({ ...prev, scope: 'organization' }))}
                    />
                    Org-wide
                  </label>
                  <label className={`flex-1 p-3 rounded-2xl border ${form.scope === 'branch' ? 'border-brand bg-brand/10 text-white' : 'border-white/10 text-white/70'} cursor-pointer flex items-center gap-2`}>
                    <input
                      type="radio"
                      className="accent-brand"
                      name="modal-scope"
                      value="branch"
                      checked={form.scope === 'branch'}
                      onChange={() => setForm((prev) => ({ ...prev, scope: 'branch' }))}
                    />
                    Branch
                  </label>
                </div>
              )}

              {(isOrgAdmin || branchOfficeId) && form.scope === 'branch' && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.3em] text-white/60 flex items-center gap-2">
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
                    className="w-full mt-2 p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-brand/50"
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

              <div>
                <label className="text-xs font-bold uppercase tracking-[0.3em] text-white/60">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full mt-2 p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-brand/50"
                  placeholder="Risk profile, payment cadence, etc."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="px-4 py-2 rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2 rounded-xl bg-brand text-white font-semibold flex items-center gap-2 disabled:opacity-60"
                >
                  {creating ? (
                    <>
                      <Loader2 className="animate-spin" size={16} /> Saving
                    </>
                  ) : (
                    <>
                      <Plus size={16} /> Save Vendor
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorManager;
