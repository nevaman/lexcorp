import React, { useState, useEffect } from 'react';
import {
  Agreement,
  AgreementStatus,
  RiskLevel,
  Clause,
  BrandSettings,
  Template,
  Vendor,
  Project,
  BranchOffice,
} from '../types';
import {
  Save,
  ArrowLeft,
  Sparkles,
  MessageSquare,
  Info,
  Store,
  Plus,
  X,
  Loader2,
  ClipboardList,
} from '../components/ui/Icons';
import { generateClauseContent, analyzeRisk } from '../services/geminiService';
import { fetchTemplates } from '../services/templateService';
import { fetchVendors, createVendor } from '../services/vendorService';
import { fetchProjects, createProject } from '../services/projectService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';

interface GeneratorProps {
  onSave: (agreement: Agreement) => Promise<void>;
  onBack: () => void;
  initialData?: Agreement;
  brandSettings: BrandSettings;
}

const defaultSections: Clause[] = [
  { id: '1', title: 'Scope of Services', content: '', type: 'standard' },
  { id: '2', title: 'Payment Terms', content: 'Payment shall be made within 30 days of invoice receipt via wire transfer. Late payments shall incur a fee of 1.5% per month.', type: 'standard' },
  { id: '3', title: 'Confidentiality', content: 'Both parties agree to keep all proprietary information confidential for a period of 5 years from the date of disclosure. This includes but is not limited to trade secrets, customer lists, and technical data.', type: 'standard' },
  { id: '4', title: 'Termination', content: 'Either party may terminate this agreement with 30 days written notice. Upon termination, all outstanding payments become immediately due.', type: 'standard' },
  { id: '5', title: 'Governing Law', content: 'This Agreement shall be governed by the laws of the State of Delaware.', type: 'standard' },
];

const AgreementGenerator: React.FC<GeneratorProps> = ({
  onSave,
  onBack,
  initialData,
  brandSettings,
}) => {
  const { organization, branchOfficeId, memberRole, isOrgAdmin, user } = useAuth();
  const isBranchAdmin = memberRole === 'branch_admin';
  const [title, setTitle] = useState(initialData?.title || 'New Agreement');
  const [counterparty, setCounterparty] = useState(initialData?.counterparty || '');
  const [type, setType] = useState(initialData?.tags?.[0] || 'Service Agreement');
  const [sections, setSections] = useState<Clause[]>(initialData?.sections || defaultSections);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [vendorError, setVendorError] = useState<string | null>(null);
  const [quickVendorError, setQuickVendorError] = useState<string | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [showQuickVendor, setShowQuickVendor] = useState(false);
  const [quickVendorSaving, setQuickVendorSaving] = useState(false);
  const [branches, setBranches] = useState<BranchOffice[]>([]);
  const [quickVendorForm, setQuickVendorForm] = useState({
    name: '',
    tin: '',
    scope: isOrgAdmin ? 'organization' : 'branch',
    branchOfficeId: branchOfficeId ?? '',
    contactEmail: '',
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    initialData?.projectId ?? null
  );
  const [showQuickProject, setShowQuickProject] = useState(false);
  const [quickProjectSaving, setQuickProjectSaving] = useState(false);
  const [quickProjectError, setQuickProjectError] = useState<string | null>(null);
  const [quickProjectForm, setQuickProjectForm] = useState({
    name: '',
    description: '',
    scope: isOrgAdmin ? 'organization' : 'branch',
    branchOfficeId: branchOfficeId ?? '',
  });
  useEffect(() => {
    const loadTemplates = async () => {
      if (!organization) return;
      try {
        const data = await fetchTemplates({
          organizationId: organization.id,
          branchOfficeId: branchOfficeId ?? null,
        });
        setTemplates(data);
      } catch (err) {
        console.warn('Failed to load templates', err);
      }
    };
    loadTemplates();
  }, [organization?.id, branchOfficeId]);

  useEffect(() => {
    const loadVendors = async () => {
      if (!organization) return;
      setVendorsLoading(true);
      setVendorError(null);
      try {
        const data = await fetchVendors({
          organizationId: organization.id,
          branchOfficeId: branchOfficeId ?? null,
          scope: isOrgAdmin ? 'all' : undefined,
        });
        setVendors(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to load vendors.';
        setVendorError(message);
      } finally {
        setVendorsLoading(false);
      }
    };
    loadVendors();
  }, [organization?.id, branchOfficeId, isOrgAdmin]);

  useEffect(() => {
    const loadProjects = async () => {
      if (!organization) return;
      setProjectsLoading(true);
      setProjectError(null);
      try {
        const data = await fetchProjects({
          organizationId: organization.id,
          branchOfficeId: isOrgAdmin ? undefined : branchOfficeId ?? null,
          scope: isOrgAdmin ? 'all' : 'branch',
          statuses: ['active'],
        });
        setProjects(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to load projects.';
        setProjectError(message);
      } finally {
        setProjectsLoading(false);
      }
    };
    loadProjects();
  }, [organization?.id, branchOfficeId, isOrgAdmin]);

  useEffect(() => {
    if (!counterparty) {
      setSelectedVendorId(null);
      return;
    }
    const match = vendors.find((v) => v.name === counterparty);
    setSelectedVendorId(match ? match.id : null);
  }, [counterparty, vendors]);

  useEffect(() => {
    const loadBranches = async () => {
      if (!organization || !isOrgAdmin) return;
      const { data, error } = await supabase
        .from('branch_offices')
        .select('id, identifier, location')
        .eq('organization_id', organization.id)
        .order('identifier', { ascending: true });
      if (!error && data) {
        setBranches(data as BranchOffice[]);
      }
    };
    loadBranches();
  }, [organization?.id, isOrgAdmin]);

  useEffect(() => {
    setQuickVendorForm((prev) => ({
      ...prev,
      branchOfficeId: branchOfficeId ?? '',
      scope: isOrgAdmin ? prev.scope : 'branch',
    }));
  }, [branchOfficeId, isOrgAdmin]);

  useEffect(() => {
    setQuickProjectForm((prev) => ({
      ...prev,
      branchOfficeId: branchOfficeId ?? '',
      scope: isOrgAdmin ? prev.scope : 'branch',
    }));
  }, [branchOfficeId, isOrgAdmin]);
  const [riskData, setRiskData] = useState<{ level: string; reason: string }>({
    level: initialData?.riskLevel || 'Low',
    reason: initialData ? 'Existing agreement loaded.' : 'Standard draft.',
  });
  const [isGenerating, setIsGenerating] = useState<string | null>(null); 
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'audit'>('details');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Logic for auto-generating AI content
  const handleGenerateClause = async (sectionId: string, sectionTitle: string) => {
    if (!counterparty || !title) {
        alert("Please fill in Title and Counterparty first.");
        return;
    }
    setIsGenerating(sectionId);
    const content = await generateClauseContent(sectionTitle, { title, counterparty, type });
    
    setSections(prev => prev.map(s => 
      s.id === sectionId ? { ...s, content, type: 'custom' } : s
    ));
    setIsGenerating(null);
  };

  // Risk Analysis Debounce
  const checkRisk = async () => {
      const fullText = sections.map(s => s.content).join(" ");
      if(fullText.length < 50) return;
      const analysis = await analyzeRisk(fullText);
      setRiskData(analysis);
  }

  useEffect(() => {
      const timer = setTimeout(() => {
         if(sections.some(s => s.content.length > 10)) checkRisk();
      }, 2000);
      return () => clearTimeout(timer);
  }, [sections]);

  useEffect(() => {
    setTitle(initialData?.title || 'New Agreement');
    setCounterparty(initialData?.counterparty || '');
    setType(initialData?.tags?.[0] || 'Service Agreement');
    setSections(initialData?.sections || defaultSections);
    setRiskData({
      level: initialData?.riskLevel || 'Low',
      reason: initialData ? 'Existing agreement loaded.' : 'Standard draft.',
    });
  }, [initialData]);

  useEffect(() => {
    if (initialData?.projectId) {
      setSelectedProjectId(initialData.projectId);
    } else if (!initialData) {
      setSelectedProjectId(null);
    }
  }, [initialData?.projectId, initialData]);

  const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'draft-' + Math.random().toString(36).substring(2, 15);
  };

  const handleVendorSelect = (value: string) => {
    if (value === '__add') {
      setQuickVendorForm({
        name: counterparty || '',
        tin: '',
        scope: isOrgAdmin ? 'organization' : 'branch',
        branchOfficeId: branchOfficeId ?? '',
        contactEmail: '',
      });
      setQuickVendorError(null);
      setShowQuickVendor(true);
      return;
    }
    if (value === '__custom') {
      setSelectedVendorId(null);
      return;
    }
    if (!value) {
      setSelectedVendorId(null);
      setCounterparty('');
      return;
    }
    setSelectedVendorId(value);
    const selected = vendors.find((vendor) => vendor.id === value);
    if (selected) {
      setCounterparty(selected.name);
    }
  };

  const handleQuickVendorClose = () => {
    setShowQuickVendor(false);
    setQuickVendorError(null);
  };

  const handleQuickVendorSave = async () => {
    if (!organization) return;
    if (!quickVendorForm.name.trim() || !quickVendorForm.tin.trim()) {
      setQuickVendorError('Vendor name and TIN are required.');
      return;
    }
    const branchAssignment = isOrgAdmin
      ? quickVendorForm.scope === 'organization'
        ? null
        : quickVendorForm.branchOfficeId || null
      : branchOfficeId;
    if (quickVendorForm.scope === 'branch' && !branchAssignment) {
      setQuickVendorError('Assign a branch to create this vendor.');
      return;
    }
    setQuickVendorSaving(true);
    setQuickVendorError(null);
    try {
      const newVendor = await createVendor({
        organizationId: organization.id,
        branchOfficeId: branchAssignment ?? null,
        name: quickVendorForm.name.trim(),
        tin: quickVendorForm.tin.trim(),
        contactEmail: quickVendorForm.contactEmail.trim() || undefined,
        createdBy: user?.id,
      });
      setVendors((prev) => [newVendor, ...prev]);
      setSelectedVendorId(newVendor.id);
      setCounterparty(newVendor.name);
      setShowQuickVendor(false);
      setQuickVendorForm({
        name: '',
        tin: '',
        scope: isOrgAdmin ? 'organization' : 'branch',
        branchOfficeId: branchOfficeId ?? '',
        contactEmail: '',
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to add vendor.';
      setQuickVendorError(message);
    } finally {
      setQuickVendorSaving(false);
    }
  };

  const handleProjectSelect = (value: string) => {
    if (value === '__add') {
      setQuickProjectForm({
        name: '',
        description: '',
        scope: isOrgAdmin ? 'organization' : 'branch',
        branchOfficeId: branchOfficeId ?? '',
      });
      setQuickProjectError(null);
      setShowQuickProject(true);
      return;
    }
    if (!value) {
      setSelectedProjectId(null);
      return;
    }
    setSelectedProjectId(value);
  };

  const handleQuickProjectClose = () => {
    setShowQuickProject(false);
    setQuickProjectError(null);
  };

  const handleQuickProjectSave = async () => {
    if (!organization) return;
    if (!quickProjectForm.name.trim()) {
      setQuickProjectError('Project name is required.');
      return;
    }
    const branchAssignment = isOrgAdmin
      ? quickProjectForm.scope === 'organization'
        ? null
        : quickProjectForm.branchOfficeId || null
      : branchOfficeId;
    if (quickProjectForm.scope === 'branch' && !branchAssignment) {
      setQuickProjectError('Assign a branch to create this project.');
      return;
    }
    setQuickProjectSaving(true);
    setQuickProjectError(null);
    try {
      const newProject = await createProject({
        organizationId: organization.id,
        branchOfficeId: branchAssignment ?? null,
        name: quickProjectForm.name.trim(),
        description: quickProjectForm.description.trim() || undefined,
        status: 'active',
        createdBy: user?.id,
      });
      setProjects((prev) => [newProject, ...prev]);
      setSelectedProjectId(newProject.id);
      setShowQuickProject(false);
      setQuickProjectForm({
        name: '',
        description: '',
        scope: isOrgAdmin ? 'organization' : 'branch',
        branchOfficeId: branchOfficeId ?? '',
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to create project.';
      setQuickProjectError(message);
    } finally {
      setQuickProjectSaving(false);
    }
  };

  const handleSave = async () => {
    const newAgreement: Agreement = {
      id: initialData?.id || generateId(),
      title,
      counterparty,
      branchOfficeId: branchOfficeId ?? initialData?.branchOfficeId ?? null,
      projectId: selectedProjectId ?? initialData?.projectId ?? null,
      department: initialData?.department || 'Legal',
      owner: initialData?.owner || 'Current User',
      effectiveDate: initialData?.effectiveDate || new Date().toISOString().split('T')[0],
      renewalDate: initialData?.renewalDate || new Date(Date.now() + 31536000000).toISOString().split('T')[0],
      value: initialData?.value ?? 15000,
      riskLevel: riskData.level as RiskLevel,
      status: initialData?.status || AgreementStatus.DRAFT,
      sections,
      tags: initialData?.tags?.length ? initialData.tags : [type],
      version: initialData?.version || 1,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: initialData?.comments || [],
      auditLog: initialData?.auditLog || []
    };
    setSaveError(null);
    setIsSaving(true);
    try {
      await onSave(newAgreement);
    } catch (err) {
      console.error('Failed to save agreement', err);
      setSaveError('Unable to save agreement. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Dynamic input handling to calculate height is complex in React.
  // We will use a visual trick where the "Page" is a container with min-height.
  // Content that overflows creates the illusion of length.
  // To truly "add a page", we render visual dividers based on estimated pixels.

  return (
    <>
      {showQuickProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[#0f172a] rounded-3xl shadow-2xl w-full max-w-lg p-8 relative">
            <button
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-800 dark:hover:text-white"
              onClick={handleQuickProjectClose}
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center">
                <ClipboardList size={20} />
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">
                  Quick Project
                </p>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Add from Drafting Studio
                </h2>
              </div>
            </div>
            {quickProjectError && (
              <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-2xl px-3 py-2 mb-4">
                {quickProjectError}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  Project Name
                </label>
                <input
                  type="text"
                  value={quickProjectForm.name}
                  onChange={(e) =>
                    setQuickProjectForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#020617] text-sm mt-1"
                  placeholder="Growth Initiative"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  Description
                </label>
                <textarea
                  value={quickProjectForm.description}
                  onChange={(e) =>
                    setQuickProjectForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#020617] text-sm mt-1"
                  placeholder="Optional summary..."
                />
              </div>
              {isOrgAdmin && (
                <div className="flex gap-3">
                  <label className="flex-1 p-3 border border-slate-200 dark:border-slate-800 rounded-xl text-sm flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="quick-project-scope"
                      value="organization"
                      checked={quickProjectForm.scope === 'organization'}
                      onChange={() =>
                        setQuickProjectForm((prev) => ({ ...prev, scope: 'organization' }))
                      }
                    />
                    Org-wide
                  </label>
                  <label className="flex-1 p-3 border border-slate-200 dark:border-slate-800 rounded-xl text-sm flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="quick-project-scope"
                      value="branch"
                      checked={quickProjectForm.scope === 'branch'}
                      onChange={() =>
                        setQuickProjectForm((prev) => ({ ...prev, scope: 'branch' }))
                      }
                    />
                    Branch
                  </label>
                </div>
              )}
              {(isOrgAdmin || branchOfficeId) && quickProjectForm.scope === 'branch' && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                    Assign Branch
                  </label>
                  <select
                    value={
                      isOrgAdmin
                        ? quickProjectForm.branchOfficeId
                        : branchOfficeId ?? quickProjectForm.branchOfficeId
                    }
                    onChange={(e) =>
                      setQuickProjectForm((prev) => ({
                        ...prev,
                        branchOfficeId: e.target.value,
                      }))
                    }
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#020617] text-sm mt-1"
                  >
                    <option value="">Select branch</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.identifier} • {branch.location}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                type="button"
                onClick={handleQuickProjectSave}
                disabled={quickProjectSaving}
                className="w-full bg-brand text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
              >
                {quickProjectSaving ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> Saving project…
                  </>
                ) : (
                  <>
                    <Plus size={16} /> Save Project
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {showQuickVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[#0f172a] rounded-3xl shadow-2xl w-full max-w-lg p-8 relative">
            <button
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-800 dark:hover:text-white"
              onClick={handleQuickVendorClose}
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center">
                <Store size={20} />
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">
                  Quick Vendor
                </p>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Add from Drafting Studio
                </h2>
              </div>
            </div>
            {quickVendorError && (
              <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-2xl px-3 py-2 mb-4">
                {quickVendorError}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  Vendor Name
                </label>
                <input
                  type="text"
                  value={quickVendorForm.name}
                  onChange={(e) =>
                    setQuickVendorForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#020617] text-sm mt-1"
                  placeholder="e.g. Polar Manufacturing"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  TIN
                </label>
                <input
                  type="text"
                  value={quickVendorForm.tin}
                  onChange={(e) =>
                    setQuickVendorForm((prev) => ({ ...prev, tin: e.target.value }))
                  }
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#020617] text-sm mt-1"
                  placeholder="Tax identification number"
                />
              </div>
              {isOrgAdmin && (
                <div className="flex gap-3">
                  <label className="flex-1 p-3 border border-slate-200 dark:border-slate-800 rounded-xl text-sm flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="quick-scope"
                      value="organization"
                      checked={quickVendorForm.scope === 'organization'}
                      onChange={() =>
                        setQuickVendorForm((prev) => ({ ...prev, scope: 'organization' }))
                      }
                    />
                    Org-wide
                  </label>
                  <label className="flex-1 p-3 border border-slate-200 dark:border-slate-800 rounded-xl text-sm flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="quick-scope"
                      value="branch"
                      checked={quickVendorForm.scope === 'branch'}
                      onChange={() =>
                        setQuickVendorForm((prev) => ({ ...prev, scope: 'branch' }))
                      }
                    />
                    Branch
                  </label>
                </div>
              )}
              {(isOrgAdmin || branchOfficeId) && quickVendorForm.scope === 'branch' && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                    Assign Branch
                  </label>
                  <select
                    value={
                      isOrgAdmin
                        ? quickVendorForm.branchOfficeId
                        : branchOfficeId ?? quickVendorForm.branchOfficeId
                    }
                    onChange={(e) =>
                      setQuickVendorForm((prev) => ({
                        ...prev,
                        branchOfficeId: e.target.value,
                      }))
                    }
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#020617] text-sm mt-1"
                  >
                    <option value="">Select branch</option>
                    {(isOrgAdmin ? branches : branches.filter((b) => b.id === branchOfficeId)).map(
                      (branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.identifier} • {branch.location}
                        </option>
                      )
                    )}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={quickVendorForm.contactEmail}
                  onChange={(e) =>
                    setQuickVendorForm((prev) => ({
                      ...prev,
                      contactEmail: e.target.value,
                    }))
                  }
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#020617] text-sm mt-1"
                  placeholder="legal@vendor.com"
                />
              </div>
              <button
                type="button"
                onClick={handleQuickVendorSave}
                disabled={quickVendorSaving}
                className="w-full bg-brand text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
              >
                {quickVendorSaving ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> Saving vendor…
                  </>
                ) : (
                  <>
                    <Plus size={16} /> Save Vendor
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex h-full bg-slate-100 dark:bg-[#020617] text-slate-900 dark:text-slate-300">
      {/* Left Sidebar: Metadata */}
      <div className="w-80 bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-white/5 flex flex-col h-full overflow-y-auto shadow-xl z-10">
        <div className="p-6 border-b border-slate-200 dark:border-white/5">
          <button onClick={onBack} className="flex items-center text-slate-500 dark:text-slate-400 hover:text-brand mb-6 transition-colors text-sm font-medium group">
            <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
          </button>
          <h2 className="font-bold text-xl text-slate-900 dark:text-white font-['Outfit']">Agreement Config</h2>
          <p className="text-xs text-slate-500 mt-1">Define core parameters</p>
        </div>

        <div className="p-6 space-y-6 flex-1">
            <div className="space-y-1">
                <label className="block text-[10px] font-bold text-brand/80 uppercase tracking-wider">Title</label>
                <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand/50 focus:border-brand outline-none transition-all"
                    placeholder="Agreement Title"
                />
            </div>
            <div className="space-y-2">
                <label className="block text-[10px] font-bold text-brand/80 uppercase tracking-wider">Counterparty</label>
                <div className="space-y-2">
                  <select
                    value={selectedVendorId ?? (counterparty ? '__custom' : '')}
                    onChange={(e) => handleVendorSelect(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand/50 outline-none"
                  >
                    <option value="">
                      {vendorsLoading ? 'Loading vendors…' : 'Select registered vendor'}
                    </option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                        {vendor.branch_office_id ? ' • Branch' : ' • Org'}
                      </option>
                    ))}
                    <option value="__custom">Manual entry</option>
                    <option value="__add">+ Add vendor</option>
                  </select>
                  {vendorError && (
                    <p className="text-xs text-red-500">{vendorError}</p>
                  )}
                  <input
                    type="text"
                    value={counterparty}
                    onChange={(e) => {
                      setSelectedVendorId(null);
                      setCounterparty(e.target.value);
                    }}
                    className="w-full p-3 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand/50 outline-none transition-all"
                    placeholder="e.g. Acme Corp"
                    readOnly={!!selectedVendorId}
                  />
                  {selectedVendorId && (
                    <p className="text-[11px] text-brand">
                      Linked to vendor record — edit vendor in the Vendors tab.
                    </p>
                  )}
                </div>
            </div>
            <div className="space-y-2">
                <label className="block text-[10px] font-bold text-brand/80 uppercase tracking-wider flex items-center gap-2">
                  <ClipboardList size={12} /> Project
                </label>
                <div className="space-y-2">
                  <select
                    value={selectedProjectId || ''}
                    onChange={(e) => handleProjectSelect(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand/50 outline-none"
                  >
                    <option value="">
                      {projectsLoading ? 'Loading projects…' : 'Unassigned'}
                    </option>
                    {projects
                      .filter((project) => project.status === 'active')
                      .map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    <option value="__add">+ Add project</option>
                  </select>
                  {projectError && (
                    <p className="text-xs text-red-500">{projectError}</p>
                  )}
                  {selectedProjectId && (
                    <p className="text-[11px] text-brand">
                      Linked to an active project workspace.
                    </p>
                  )}
                </div>
            </div>
            <div className="space-y-1">
                <label className="block text-[10px] font-bold text-brand/80 uppercase tracking-wider">Template</label>
                <div className="relative">
                    <select 
                        value={type}
                        onChange={(e) => {
                          const selected = templates.find(t => t.name === e.target.value);
                          setType(e.target.value);
                          if (selected) {
                            setSections(
                              selected.sections?.map((section) => ({
                                id: section.id || crypto.randomUUID(),
                                title: section.title,
                                content: section.content,
                                type: 'standard',
                              })) || defaultSections
                            );
                          }
                        }}
                        className="w-full p-3 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand/50 outline-none appearance-none"
                    >
                        <option value="">Select template</option>
                        {templates.map((tmpl) => (
                          <option key={tmpl.id} value={tmpl.name}>
                            {tmpl.name}
                          </option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-3.5 pointer-events-none text-slate-400">▼</div>
                </div>
            </div>
            <div className="space-y-1">
                <label className="block text-[10px] font-bold text-brand/80 uppercase tracking-wider">Effective Date</label>
                <input type="date" className="w-full p-3 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-500 dark:text-slate-300 focus:ring-2 focus:ring-brand/50 outline-none dark:[color-scheme:dark]" />
            </div>

             {/* Auto Summary Box */}
            <div className="bg-slate-100 dark:bg-[#1e293b]/50 p-4 rounded-xl border border-slate-200 dark:border-white/5 mt-6 backdrop-blur-sm">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest">Live AI Risk Analysis</h3>
                <div className="flex items-center gap-3 mb-2">
                    <div className={`w-3 h-3 rounded-full shadow-[0_0_10px] ${riskData.level === 'High' ? 'bg-red-500 shadow-red-500/50' : riskData.level === 'Medium' ? 'bg-amber-500 shadow-amber-500/50' : 'bg-emerald-500 shadow-emerald-500/50'}`}></div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{riskData.level} Risk</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-l-2 border-slate-300 dark:border-slate-700 pl-3">{riskData.reason}</p>
            </div>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-white/5 bg-white dark:bg-[#020617] space-y-3">
            {saveError && (
              <p className="text-xs text-red-500 font-semibold text-center">{saveError}</p>
            )}
            <button 
                onClick={handleSave}
                disabled={isSaving}
                className="w-full bg-brand hover:bg-brand/90 disabled:bg-brand/60 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-bold shadow-lg shadow-brand/30 transition-all transform hover:scale-[1.02]"
            >
                {isSaving ? (
                  <>
                    <Save size={18} className="animate-pulse" /> Saving...
                  </>
                ) : (
                  <>
                <Save size={18} /> Save & Finalize
                  </>
                )}
            </button>
        </div>
      </div>

      {/* Center: Editor (A4 Paper Representation) */}
      <div className="flex-1 overflow-y-auto p-8 relative bg-slate-200 dark:bg-[#020617] flex flex-col items-center">
         {/* Background Desk Texture */}
         <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>

         {/* A4 PAGE 1 */}
         <div className="a4-page transition-all" style={{ fontFamily: brandSettings.fontFamily }}>
            
            {/* Header Branding on Paper */}
            <div className="flex justify-between items-end mb-16 border-b-4 pb-6" style={{ borderColor: brandSettings.primaryColor }}>
                 <div>
                     {brandSettings.logoUrl ? (
                       <img src={brandSettings.logoUrl} alt="Logo" className="h-12 mb-4" />
                     ) : (
                       <div className="text-3xl font-serif font-black tracking-tight mb-2 text-slate-900">{brandSettings.companyName.toUpperCase()}</div>
                     )}
                     <div className="text-xs font-bold tracking-[0.3em] text-slate-500 uppercase">Legal Binding Document</div>
                 </div>
                 <div className="text-right text-xs text-slate-400 font-mono">
                     <p>REF: {initialData?.id.slice(0,8).toUpperCase() || "DFT-INIT-001"}</p>
                     <p>DATE: {new Date().toLocaleDateString()}</p>
                 </div>
            </div>

            <div className="mb-12 text-center">
                <h1 className="text-2xl font-bold text-slate-900 mb-4 uppercase tracking-wide">{title}</h1>
                <p className="text-slate-500 font-serif italic text-lg">Between <span className="font-bold text-slate-900">{brandSettings.companyName}</span> and <span className="font-bold text-slate-900">{counterparty || "[Counterparty Name]"}</span></p>
            </div>

            {/* Sections Container */}
            <div className="space-y-8 text-slate-800">
                {sections.map((section, index) => (
                    <div key={section.id} className="group relative transition-all">
                        
                        {/* Simulated Page Break logic for visual effect if index is high (Demo purposes) */}
                        {index === 3 && <div className="page-break-marker" />}

                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">{section.title}</h3>
                            
                            {/* Floating Action Button for Clause */}
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                                <button 
                                    onClick={() => handleGenerateClause(section.id, section.title)}
                                    disabled={isGenerating === section.id}
                                    className={`text-[10px] px-2 py-1 rounded flex items-center gap-1 border transition-all font-bold uppercase tracking-wide ${
                                      isGenerating === section.id 
                                      ? 'bg-brand/10 border-brand/30 text-brand cursor-wait' 
                                      : 'bg-white border-slate-200 text-slate-500 hover:border-brand hover:text-brand shadow-sm'
                                    }`}
                                >
                                    <Sparkles size={10} className={isGenerating === section.id ? "animate-spin" : ""} /> 
                                    {isGenerating === section.id ? 'Drafting...' : 'AI Rewrite'}
                                </button>
                            </div>
                        </div>
                        <textarea
                            value={section.content}
                            onChange={(e) => {
                                const newVal = e.target.value;
                                setSections(prev => prev.map(s => s.id === section.id ? { ...s, content: newVal, type: 'custom' } : s));
                            }}
                            placeholder={`Enter ${section.title} details here...`}
                            className="w-full min-h-[80px] bg-transparent hover:bg-slate-50 focus:bg-slate-50 p-2 -ml-2 rounded text-[14px] leading-relaxed text-slate-800 border-none focus:ring-0 resize-none overflow-hidden transition-colors placeholder:italic placeholder:text-slate-300"
                            rows={Math.max(3, section.content.split('\n').length)}
                        />
                    </div>
                ))}

                {/* Add Section Button */}
                <button 
                    onClick={() => setSections([...sections, { id: Date.now().toString(), title: 'New Section', content: '', type: 'custom' }])}
                    className="w-full py-4 border-2 border-dashed border-slate-200 text-slate-400 rounded-lg hover:border-brand hover:text-brand hover:bg-brand/5 transition-all flex items-center justify-center gap-2 group mt-8"
                >
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center group-hover:bg-brand/20 group-hover:text-brand transition-colors">+</span> 
                    <span className="font-medium text-sm">Add Next Clause</span>
                </button>
            </div>

            {/* Signatures (Pushed to bottom or next page) */}
            <div className="mt-24 pt-12 border-t-4 border-slate-900 grid grid-cols-2 gap-16">
                <div>
                    <p className="text-sm font-bold text-slate-900 mb-16">{brandSettings.companyName}</p>
                    <div className="border-t border-slate-400 pt-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Authorized Signature</p>
                    </div>
                </div>
                <div>
                    <p className="text-sm font-bold text-slate-900 mb-16">{counterparty || "Counterparty Name"}</p>
                    <div className="border-t border-slate-400 pt-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Authorized Signature</p>
                    </div>
                </div>
            </div>
            
            {/* Page Number Footer */}
            <div className="absolute bottom-4 right-8 text-[10px] text-slate-400 font-mono">Page 1 of 1</div>
         </div>

         {/* Visual Stack Effect under the page */}
         <div className="w-[200mm] h-2 bg-white/50 dark:bg-white/5 rounded-b mx-auto -mt-8 shadow-md"></div>
         <div className="w-[190mm] h-2 bg-white/30 dark:bg-white/5 rounded-b mx-auto -mt-2 shadow-sm"></div>
      </div>

      {/* Right Sidebar: Tools */}
      <div className="w-72 bg-white dark:bg-[#0f172a] border-l border-slate-200 dark:border-white/5 flex flex-col shadow-xl z-10">
          <div className="flex border-b border-slate-200 dark:border-white/5">
              <button onClick={() => setActiveTab('details')} className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'details' ? 'text-brand border-b-2 border-brand bg-brand/5' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}>Clauses</button>
              <button onClick={() => setActiveTab('comments')} className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'comments' ? 'text-brand border-b-2 border-brand bg-brand/5' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}>Chat</button>
              <button onClick={() => setActiveTab('audit')} className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'audit' ? 'text-brand border-b-2 border-brand bg-brand/5' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}>History</button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5">
              {activeTab === 'details' && (
                  <div className="space-y-6">
                      <div className="p-4 bg-slate-50 dark:bg-[#1e293b] rounded-xl border border-slate-200 dark:border-white/5">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2"><Info size={14} className="text-brand"/> Library</h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">Drag standard clauses to reset modified sections or enrich the contract.</p>
                          <div className="space-y-2.5">
                              {['Indemnification', 'Force Majeure', 'Governing Law', 'Non-Compete', 'Warranty'].map(c => (
                                  <div key={c} className="bg-white dark:bg-[#020617] p-3 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-300 shadow-sm cursor-grab hover:border-brand hover:text-brand transition-colors flex justify-between items-center group">
                                      {c}
                                      <span className="opacity-0 group-hover:opacity-100 text-[10px] text-brand">+</span>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              )}

              {activeTab === 'comments' && (
                  <div className="text-center py-16">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                         <MessageSquare size={20} className="text-slate-500" />
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">No comments yet</p>
                      <p className="text-xs text-slate-400 dark:text-slate-600 mt-1 px-4">Start a discussion with the legal team.</p>
                  </div>
              )}

              {activeTab === 'audit' && (
                 <div className="space-y-6 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-slate-800 pl-2">
                     <div className="relative pl-6">
                         <div className="absolute left-0 top-1 w-4 h-4 bg-white dark:bg-[#0f172a] border-2 border-brand rounded-full z-10"></div>
                         <div>
                             <p className="text-xs text-slate-900 dark:text-white font-medium">Draft Initialized</p>
                             <p className="text-[10px] text-slate-500 mt-0.5">By System User • Just now</p>
                         </div>
                     </div>
                 </div>
              )}
          </div>
      </div>
    </div>
    </>
  );
};

export default AgreementGenerator;
