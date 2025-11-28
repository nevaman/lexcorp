import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Agreement,
  BranchOffice,
  BrandSettings,
  Project,
  ProjectStatus,
} from '../types';
import {
  ClipboardList,
  Loader2,
  Plus,
  MapPin,
  Calendar,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  X,
} from '../components/ui/Icons';
import {
  fetchProjects,
  createProject,
  updateProjectStatus,
} from '../services/projectService';
import { fetchAgreementsForProject } from '../services/agreementService';
import { supabase } from '../services/supabaseClient';

type ProjectFormState = {
  name: string;
  description: string;
  status: ProjectStatus;
  scope: 'organization' | 'branch';
  branchOfficeId: string;
  startDate: string;
  endDate: string;
};

interface ProjectManagerProps {
  brandSettings?: BrandSettings;
}

const initialFormState = (
  scope: 'organization' | 'branch',
  branchOfficeId?: string | null
): ProjectFormState => ({
  name: '',
  description: '',
  status: 'active',
  scope,
  branchOfficeId: branchOfficeId ?? '',
  startDate: '',
  endDate: '',
});

const statusLabels: Record<ProjectStatus, string> = {
  active: 'Active',
  onhold: 'On Hold',
  completed: 'Completed',
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : '—';

const ProjectManager: React.FC<ProjectManagerProps> = ({ brandSettings }) => {
  const {
    organization,
    isOrgAdmin,
    branchOfficeId,
    memberRole,
    user,
  } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [offices, setOffices] = useState<BranchOffice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'organization' | 'branch'>(
    isOrgAdmin ? 'all' : 'branch'
  );
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormState>(
    initialFormState(isOrgAdmin ? 'organization' : 'branch', branchOfficeId)
  );
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectAgreements, setProjectAgreements] = useState<Agreement[]>([]);
  const [agreementsLoading, setAgreementsLoading] = useState(false);
  const [previewAgreement, setPreviewAgreement] = useState<Agreement | null>(null);

  const appliedBrand = useMemo<BrandSettings>(() => {
    if (brandSettings) return brandSettings;
    return {
      companyName: organization?.name || 'LexCorp',
      primaryColor: '#f97316',
      fontFamily: 'DM Sans',
      logoUrl: null,
      tone: 'Professional',
    };
  }, [brandSettings, organization?.name]);

  const branchLocked = memberRole === 'branch_admin' && !branchOfficeId;

  const loadOffices = async () => {
    if (!organization) return;
    let query = supabase
      .from('branch_offices')
      .select('id, identifier, location')
      .eq('organization_id', organization.id)
      .order('identifier', { ascending: true });

    if (!isOrgAdmin && branchOfficeId) {
      query = query.eq('id', branchOfficeId);
    }

    const { data, error } = await query;
    if (!error && data) {
      setOffices(data as BranchOffice[]);
    }
  };

  const loadProjects = async () => {
    if (!organization) return;
    if (branchLocked) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setTableError(null);
    try {
      const statuses =
        statusFilter === 'all' ? undefined : [statusFilter];
      const data = await fetchProjects({
        organizationId: organization.id,
        branchOfficeId: branchFilter === 'all' ? branchOfficeId ?? null : branchFilter,
        scope: isOrgAdmin ? scopeFilter : 'branch',
        statuses,
      });
      setProjects(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load projects.';
      setTableError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOffices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, branchOfficeId, isOrgAdmin]);

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, statusFilter, scopeFilter, branchFilter, branchOfficeId, memberRole]);

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
    const total = projects.length;
    const byStatus = projects.reduce<Record<ProjectStatus, number>>(
      (acc, project) => {
        acc[project.status] = (acc[project.status] || 0) + 1;
        return acc;
      },
      { active: 0, onhold: 0, completed: 0 }
    );
    return {
      total,
      active: byStatus.active || 0,
      onhold: byStatus.onhold || 0,
      completed: byStatus.completed || 0,
    };
  }, [projects]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }),
    []
  );

  const getScopeLabel = (project: Project) =>
    project.branch_office_id
      ? offices.find((o) => o.id === project.branch_office_id)?.identifier ??
        'Branch'
      : 'Organization-wide';

  const filteredProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter((project) => {
      const scope = getScopeLabel(project).toLowerCase();
      return (
        project.name.toLowerCase().includes(term) ||
        (project.description || '').toLowerCase().includes(term) ||
        scope.includes(term)
      );
    });
  }, [projects, searchTerm, offices]);

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

  const handleCreateProject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!organization) return;
    if (!form.name.trim()) {
      setFormError('Project name is required.');
      return;
    }
    if (form.scope === 'branch' && !(form.branchOfficeId || branchOfficeId)) {
      setFormError('Select a branch for branch-scoped projects.');
      return;
    }
    setCreating(true);
    setFormError(null);
    setSuccess(null);
    try {
      const newProject = await createProject({
        organizationId: organization.id,
        branchOfficeId:
          form.scope === 'organization'
            ? null
            : form.branchOfficeId || branchOfficeId || null,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        status: form.status,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        createdBy: user?.id,
      });
      setProjects((prev) => [newProject, ...prev]);
      setSuccess('Project created successfully.');
      closeCreateModal();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to create project.';
      setFormError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (
    projectId: string,
    status: ProjectStatus
  ) => {
    try {
      const updated = await updateProjectStatus(projectId, status);
      setProjects((prev) =>
        prev.map((project) => (project.id === updated.id ? updated : project))
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to update status.';
      setTableError(message);
    }
  };

  const handleOpenProject = async (project: Project) => {
    if (!organization) return;
    setSelectedProject(project);
    setAgreementsLoading(true);
    try {
      const agreements = await fetchAgreementsForProject(
        organization.id,
        project.id
      );
      setProjectAgreements(agreements);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load agreements.';
      setTableError(message);
    } finally {
      setAgreementsLoading(false);
    }
  };

  if (!organization) return null;

  if (branchLocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-500 p-10 text-center">
        <ClipboardList size={36} className="mb-4 text-brand" />
        <p className="text-lg font-semibold">
          Assign this branch admin to a branch to manage projects.
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
              Project Portfolio
            </p>
            <h1 className="text-4xl font-bold font-['Outfit'] mt-2 flex items-center gap-3">
              <ClipboardList size={32} className="text-brand" />
              Strategic Workstreams
            </h1>
            <p className="text-sm text-white/60 mt-2 max-w-2xl">
              Organize agreements under active initiatives and maintain visibility into each
              branch’s execution.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={openCreateModal}
              className="bg-brand text-white px-6 py-3 rounded-2xl font-semibold shadow-lg shadow-brand/30 flex items-center gap-2"
            >
              <Plus size={16} /> New Project
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-5">
            <p className="text-[10px] uppercase tracking-[0.4em] text-white/50">
              Total Projects
            </p>
            <p className="text-4xl font-bold mt-2">{stats.total}</p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-6 py-5">
            <p className="text-[10px] uppercase tracking-[0.4em] text-emerald-200/80">
              Active
            </p>
            <p className="text-4xl font-bold mt-2 text-white">{stats.active}</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-6 py-5">
            <p className="text-[10px] uppercase tracking-[0.4em] text-amber-200/80">
              On Hold
            </p>
            <p className="text-4xl font-bold mt-2 text-white">{stats.onhold}</p>
          </div>
          <div className="bg-slate-500/10 border border-slate-500/30 rounded-2xl px-6 py-5">
            <p className="text-[10px] uppercase tracking-[0.4em] text-white/60">
              Completed
            </p>
            <p className="text-4xl font-bold mt-2">{stats.completed}</p>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border border-white/10">
          <div className="relative flex-1 w-full max-w-xl">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search projects by name, branch, description..."
              className="w-full pl-4 pr-4 py-3 rounded-xl bg-white/5 border border-transparent text-sm text-white placeholder-white/40 focus:bg-white/10 focus:border-brand/40 outline-none transition-colors"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(['all', 'active', 'onhold', 'completed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest ${
                  statusFilter === status
                    ? 'bg-brand text-white shadow-lg shadow-brand/30'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {status === 'all' ? 'All' : statusLabels[status]}
              </button>
            ))}
          </div>
          {isOrgAdmin && (
            <div className="flex items-center gap-2 flex-wrap">
              {['all', 'organization', 'branch'].map((scope) => (
                <button
                  key={scope}
                  onClick={() => setScopeFilter(scope as typeof scopeFilter)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest ${
                    scopeFilter === scope
                      ? 'bg-white/20 text-white shadow-lg shadow-white/20'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {scope === 'all'
                    ? 'All scopes'
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

        <div className="border border-white/5 rounded-3xl bg-white/5 backdrop-blur flex flex-col shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/60 text-[11px] uppercase tracking-[0.3em]">
                  <th className="px-8 py-4">Project</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Scope</th>
                  <th className="px-6 py-4">Dates</th>
                  <th className="px-6 py-4 text-right">Agreements</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center">
                      <Loader2 className="animate-spin text-white/60" size={28} />
                    </td>
                  </tr>
                ) : filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-white/60">
                      No projects match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((project) => (
                    <tr
                      key={project.id}
                      className="hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => handleOpenProject(project)}
                    >
                      <td className="px-8 py-5">
                        <p className="font-semibold text-white">{project.name}</p>
                        <p className="text-xs text-white/50 mt-1">
                          {project.description || 'No description'}
                        </p>
                      </td>
                      <td className="px-6 py-5">
                        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/10 rounded-full px-3 py-1">
                          {project.status === 'active' && (
                            <CheckCircle2 size={14} className="text-emerald-400" />
                          )}
                          {project.status === 'onhold' && (
                            <AlertTriangle size={14} className="text-amber-400" />
                          )}
                          {project.status === 'completed' && (
                            <CheckCircle2 size={14} className="text-slate-300" />
                          )}
                          <select
                            value={project.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              handleStatusChange(
                                project.id,
                                e.target.value as ProjectStatus
                              )
                            }
                            className="bg-transparent text-white text-xs"
                          >
                            {(['active', 'onhold', 'completed'] as ProjectStatus[]).map(
                              (status) => (
                                <option
                                  key={status}
                                  value={status}
                                  className="text-slate-900"
                                >
                                  {statusLabels[status]}
                                </option>
                              )
                            )}
                          </select>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-white/70">
                        {getScopeLabel(project)}
                      </td>
                      <td className="px-6 py-5 text-white/70">
                        <div className="flex items-center gap-2 text-xs">
                          <Calendar size={14} className="text-white/40" />
                          {project.start_date
                            ? new Date(project.start_date).toLocaleDateString()
                            : '—'}
                        </div>
                        {project.end_date && (
                          <div className="flex items-center gap-2 text-xs text-white/50 mt-1">
                            <Calendar size={14} className="text-white/30" />
                            {new Date(project.end_date).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right text-white/70">
                        <button
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-xs uppercase tracking-[0.3em]"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenProject(project);
                          }}
                        >
                          View <ChevronDown size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
              <p className="text-[11px] uppercase tracking-[0.4em] text-slate-400">
                Register Project
              </p>
              <h2 className="text-3xl font-bold text-white mt-2">
                Project Intake
              </h2>
            </div>
            {formError && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-200 text-sm px-4 py-3 rounded-2xl mb-4">
                {formError}
              </div>
            )}
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.3em] text-white/60">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full mt-2 p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-brand/50"
                    placeholder="Expansion Initiative"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.3em] text-white/60">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value as ProjectStatus,
                      })
                    }
                    className="w-full mt-2 p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-brand/50"
                  >
                    {(['active', 'onhold', 'completed'] as ProjectStatus[]).map(
                      (status) => (
                        <option key={status} value={status} className="text-slate-900">
                          {statusLabels[status]}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.3em] text-white/60">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full mt-2 p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-brand/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.3em] text-white/60">
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full mt-2 p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-brand/50"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.3em] text-white/60">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full mt-2 p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-brand/50"
                  placeholder="Key deliverables, scope, objectives..."
                />
              </div>
              {isOrgAdmin && (
                <div className="flex gap-3">
                  <label
                    className={`flex-1 p-3 rounded-2xl border ${
                      form.scope === 'organization'
                        ? 'border-brand bg-brand/10 text-white'
                        : 'border-white/10 text-white/70'
                    } cursor-pointer flex items-center gap-2`}
                  >
                    <input
                      type="radio"
                      className="accent-brand"
                      name="project-scope"
                      value="organization"
                      checked={form.scope === 'organization'}
                      onChange={() =>
                        setForm((prev) => ({ ...prev, scope: 'organization' }))
                      }
                    />
                    Org-wide
                  </label>
                  <label
                    className={`flex-1 p-3 rounded-2xl border ${
                      form.scope === 'branch'
                        ? 'border-brand bg-brand/10 text-white'
                        : 'border-white/10 text-white/70'
                    } cursor-pointer flex items-center gap-2`}
                  >
                    <input
                      type="radio"
                      className="accent-brand"
                      name="project-scope"
                      value="branch"
                      checked={form.scope === 'branch'}
                      onChange={() =>
                        setForm((prev) => ({ ...prev, scope: 'branch' }))
                      }
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
                      <Plus size={16} /> Save Project
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedProject && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-[#0f172a] w-full max-w-3xl rounded-3xl p-8 relative border border-white/10">
            <button
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
              onClick={() => {
                setSelectedProject(null);
                setProjectAgreements([]);
                setPreviewAgreement(null);
              }}
            >
              <X size={18} />
            </button>
            <div className="mb-6">
              <p className="text-[11px] uppercase tracking-[0.4em] text-slate-400">
                Agreements
              </p>
              <h2 className="text-3xl font-bold text-white mt-2">
                {selectedProject.name}
              </h2>
              <p className="text-sm text-white/60 mt-1">
                {selectedProject.description || 'No description'}
              </p>
            </div>
            {agreementsLoading ? (
              <div className="py-20 text-center">
                <Loader2 className="animate-spin text-white/60" size={28} />
              </div>
            ) : projectAgreements.length === 0 ? (
              <div className="py-20 text-center text-white/60">
                No agreements linked to this project yet.
              </div>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {projectAgreements.map((agreement) => (
                  <div
                    key={agreement.id}
                    className="border border-white/10 rounded-2xl p-4 bg-white/5 cursor-pointer hover:border-brand/40 transition"
                    onClick={() => setPreviewAgreement(agreement)}
                  >
                    <p className="font-semibold text-white">{agreement.title}</p>
                    <p className="text-xs text-white/50">
                      Counterparty: {agreement.counterparty}
                    </p>
                    <p className="text-xs text-white/50 mt-1">
                      Status: {agreement.status}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {previewAgreement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-8">
          <div className="relative w-full max-w-6xl">
            <button
              className="absolute top-4 right-4 text-white/60 hover:text-white z-10"
              onClick={() => setPreviewAgreement(null)}
            >
              <X size={18} />
            </button>
            <div className="grid gap-0 lg:grid-cols-[280px_1fr] rounded-3xl overflow-hidden border border-white/10 shadow-[0_40px_140px_rgba(15,23,42,0.7)] bg-white dark:bg-[#050b1b]">
              <aside className="bg-slate-900 text-white p-8 space-y-6">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.4em] text-white/60">
                    Agreement Preview
                  </p>
                  <h3 className="text-2xl font-bold mt-2 leading-tight">
                    {previewAgreement.title}
                  </h3>
                  <p className="text-sm text-white/70 mt-1">
                    Counterparty: {previewAgreement.counterparty || 'Unassigned'}
                  </p>
                </div>
                <div className="space-y-3 text-sm text-white/80">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                      Status
                    </p>
                    <p className="font-semibold">{previewAgreement.status}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                      Risk
                    </p>
                    <p className="font-semibold">{previewAgreement.riskLevel}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                      Project
                    </p>
                    <p className="font-semibold">
                      {selectedProject?.name || 'Independent'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                      Scope
                    </p>
                    <p className="font-semibold">
                      {selectedProject ? getScopeLabel(selectedProject) : 'Organization-wide'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                        Effective
                      </p>
                      <p className="font-semibold">
                        {formatDate(previewAgreement.effectiveDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                        Renewal
                      </p>
                      <p className="font-semibold">
                        {formatDate(previewAgreement.renewalDate)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                      Agreement Value
                    </p>
                    <p className="font-semibold">
                      {previewAgreement.value
                        ? currencyFormatter.format(previewAgreement.value)
                        : '—'}
                    </p>
                  </div>
                </div>
              </aside>
              <section className="bg-slate-100 dark:bg-[#020617] p-4 sm:p-8">
                <div className="max-h-[80vh] overflow-y-auto flex justify-center">
                  <div
                    className="relative w-[210mm] min-h-[297mm] bg-white text-slate-900 rounded-[32px] p-10 shadow-[0_30px_80px_rgba(15,23,42,0.45)]"
                    style={{ fontFamily: appliedBrand.fontFamily }}
                  >
                    <div
                      className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b-4 pb-6 mb-10"
                      style={{ borderColor: appliedBrand.primaryColor }}
                    >
                      <div>
                        {appliedBrand.logoUrl ? (
                          <img
                            src={appliedBrand.logoUrl}
                            alt={`${appliedBrand.companyName} logo`}
                            className="h-12 object-contain"
                          />
                        ) : (
                          <p className="text-3xl font-black tracking-tight uppercase">
                            {appliedBrand.companyName}
                          </p>
                        )}
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500 mt-2">
                          Legal Agreement Preview
                        </p>
                      </div>
                      <div className="text-right text-xs text-slate-500 font-mono">
                        <p>REF: {previewAgreement.id.slice(0, 8).toUpperCase()}</p>
                        <p>DATE: {new Date().toLocaleDateString()}</p>
                      </div>
                    </div>

                    <div className="text-center mb-12">
                      <h2 className="text-3xl font-bold tracking-wide">
                        {previewAgreement.title}
                      </h2>
                      <p className="text-slate-500 italic text-base mt-3">
                        Between{' '}
                        <span className="font-semibold text-slate-900">
                          {appliedBrand.companyName}
                        </span>{' '}
                        and{' '}
                        <span className="font-semibold text-slate-900">
                          {previewAgreement.counterparty || 'Counterparty'}
                        </span>
                      </p>
                    </div>

                    <div className="space-y-8">
                      {previewAgreement.sections.map((section, index) => (
                        <div key={section.id || `${section.title}-${index}`} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
                              {section.type?.toUpperCase() || 'CLAUSE'}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              Section {index + 1}
                            </span>
                          </div>
                          <h4 className="text-lg font-semibold text-slate-900">
                            {section.title}
                          </h4>
                          <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                            {section.content || 'Clause text forthcoming.'}
                          </p>
                          <div className="h-px bg-slate-200"></div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-16 mt-16 pt-10 border-t border-slate-200">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 mb-16">
                          {appliedBrand.companyName}
                        </p>
                        <div className="border-t border-slate-400 pt-3">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em]">
                            Authorized Signature
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 mb-16">
                          {previewAgreement.counterparty || 'Counterparty'}
                        </p>
                        <div className="border-t border-slate-400 pt-3">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em]">
                            Authorized Signature
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="absolute bottom-6 right-10 text-xs text-slate-400 font-mono">
                      Preview • {selectedProject?.name || 'General'}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectManager;
