import React, { useEffect, useState } from 'react';
import {
  FilePlus,
  MoreVertical,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Settings,
  Copy,
  Loader2,
  Sparkles,
} from '../components/ui/Icons';
import { useAuth } from '../contexts/AuthContext';
import { Template } from '../types';
import { fetchTemplates, saveTemplate } from '../services/templateService';

type DraftSection = {
  id: string;
  title: string;
  required: boolean;
  content: string;
};

const COMMON_SECTIONS: DraftSection[] = [
  {
    id: 'confidentiality',
    title: 'Confidentiality',
    required: true,
    content:
      'Both parties agree to keep all proprietary information confidential and to use it solely for the purposes of this Agreement.',
  },
  {
    id: 'termination',
    title: 'Termination',
    required: true,
    content:
      'Either party may terminate this Agreement upon 30 days written notice in the event of a material breach not cured within 15 days.',
  },
  {
    id: 'indemnification',
    title: 'Indemnification',
    required: false,
    content:
      'Each party shall defend, indemnify, and hold the other harmless from third-party claims arising from its negligence or willful misconduct.',
  },
  {
    id: 'governing-law',
    title: 'Governing Law',
    required: true,
    content: 'This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware.',
  },
  {
    id: 'payment-terms',
    title: 'Payment Terms',
    required: true,
    content:
      'Invoices are due within thirty (30) days of receipt. Late payments accrue interest at 1.5% per month or the maximum rate permitted by law.',
  },
];

const TemplateBuilder: React.FC = () => {
  const { organization, branchOfficeId, memberRole, user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftSection[]>([]);
  const [templateMeta, setTemplateMeta] = useState({
    name: '',
    description: '',
    visibility: 'organization' as 'organization' | 'branch',
  });

  const isOrgAdmin = memberRole === 'org_admin';
  const isBranchAdmin = memberRole === 'branch_admin';
  const canEdit = isOrgAdmin || isBranchAdmin;

  const loadTemplates = async () => {
    if (!organization) {
      setTemplates([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTemplates({
        organizationId: organization.id,
        branchOfficeId: branchOfficeId ?? null,
      });
      setTemplates(data);
      if (data.length) {
        setActiveTemplateId(data[0].id);
        setTemplateMeta({
          name: data[0].name,
          description: data[0].description || '',
          visibility: data[0].visibility,
        });
        setDraft(data[0].sections as DraftSection[]);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load templates.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [organization?.id, branchOfficeId]);

  useEffect(() => {
    if (!activeTemplateId) return;
    const tmpl = templates.find((t) => t.id === activeTemplateId);
    if (tmpl) {
      setTemplateMeta({
        name: tmpl.name,
        description: tmpl.description || '',
        visibility: tmpl.visibility,
      });
      setDraft(tmpl.sections as DraftSection[]);
    }
  }, [activeTemplateId, templates]);

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    setDraft((prev) => {
      if (
        (direction === 'up' && index === 0) ||
        (direction === 'down' && index === prev.length - 1)
      ) {
        return prev;
      }
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const handleAddSection = () => {
    setDraft((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: 'New Section',
        required: false,
        content: '',
      },
    ]);
  };

  const handleDuplicate = (section: DraftSection) => {
    setDraft((prev) => [
      ...prev,
      {
        ...section,
        id: crypto.randomUUID(),
        title: `${section.title} Copy`,
      },
    ]);
  };

  const handleAddCommonSection = (section: DraftSection) => {
    if (!canEdit) return;
    setDraft((prev) => [
      ...prev,
      {
        ...section,
        id: crypto.randomUUID(),
      },
    ]);
  };

  const handleRemove = (sectionId: string) => {
    setDraft((prev) => prev.filter((s) => s.id !== sectionId));
  };

  const handleSave = async () => {
    if (!organization || !user) return;
    if (!templateMeta.name.trim()) {
      setError('Template name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const templateId = activeTemplateId ?? crypto.randomUUID();
      const effectiveVisibility = isOrgAdmin ? templateMeta.visibility : 'branch';
      const branchTarget =
        effectiveVisibility === 'branch' ? branchOfficeId ?? null : null;
      if (effectiveVisibility === 'branch' && !branchTarget) {
        setError('Branch templates require a branch office context.');
        setSaving(false);
        return;
      }
      const payload: Template = {
        id: templateId,
        organization_id: organization.id,
        branch_office_id: branchTarget,
        name: templateMeta.name.trim(),
        description: templateMeta.description.trim(),
        visibility: effectiveVisibility,
        sections: draft,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const saved = await saveTemplate(payload);
      setSuccess('Template saved.');
      if (!activeTemplateId) setActiveTemplateId(saved.id);
      loadTemplates();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to save template.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-10 h-full overflow-y-auto text-slate-900 dark:text-slate-200">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-['Outfit']">
            Template Builder
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Architect standardized legal structures. Templates are shared across your organization.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              if (isBranchAdmin && !branchOfficeId) {
                setError('Branch templates require an assigned office.');
                return;
              }
              const newId = crypto.randomUUID();
              setTemplates((prev) => [
                {
                  id: newId,
                  organization_id: organization?.id || '',
                  branch_office_id: null,
                  name: 'New Template',
                  description: '',
                  visibility: isBranchAdmin ? 'branch' : 'organization',
                  sections: [],
                  created_by: user?.id || null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                ...prev,
              ]);
              setActiveTemplateId(newId);
              setTemplateMeta({
                name: 'New Template',
                description: '',
                visibility: isBranchAdmin ? 'branch' : 'organization',
              });
              setDraft([]);
            }}
            className="px-4 py-2 rounded-xl bg-brand text-white font-semibold flex items-center gap-2"
          >
            <Plus size={16} /> New Template
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl">
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-brand" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/5 rounded-xl shadow-sm dark:shadow-lg p-6 h-fit space-y-4">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white mb-2">Template Library</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose an existing template to edit.
              </p>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {templates.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No templates yet. Create one to get started.
                </p>
              )}
              {templates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => setActiveTemplateId(tmpl.id)}
                  className={`w-full p-4 rounded-lg border text-left transition-all flex justify-between items-center ${
                    tmpl.id === activeTemplateId
                      ? 'border-brand/50 bg-brand/10'
                      : 'border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/5 hover:border-slate-300 dark:hover:border-white/10'
                  }`}
                >
                  <div>
                    <p
                      className={`text-sm font-medium ${
                        tmpl.id === activeTemplateId
                          ? 'text-brand'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {tmpl.name}
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.4em] text-slate-400 mt-1">
                      {tmpl.visibility === 'organization' ? 'Org-wide' : 'Branch'}
                    </p>
                  </div>
                  {tmpl.id === activeTemplateId && (
                    <span className="text-[10px] bg-brand text-white px-2 py-0.5 rounded font-bold uppercase">
                      Active
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.4em]">
                Common Clauses
              </p>
              <div className="grid grid-cols-1 gap-2 text-sm">
                {COMMON_SECTIONS.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => handleAddCommonSection(section)}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-white/5 hover:border-brand/40 hover:bg-brand/5 text-left text-slate-600 dark:text-slate-300"
                    disabled={!canEdit}
                  >
                    <span>{section.title}</span>
                    <span className="text-[10px] uppercase tracking-[0.4em] text-slate-400">
                      Add
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="xl:col-span-2 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/5 rounded-xl p-8 relative overflow-hidden shadow-sm dark:shadow-2xl">
            <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
            <div className="max-w-2xl mx-auto bg-white shadow-2xl rounded-lg overflow-hidden border border-slate-200 dark:border-0 min-h-[600px] flex flex-col relative z-10">
              <div className="bg-slate-900 text-white p-5 flex flex-col gap-3 border-b border-slate-800">
                <input
                  type="text"
                  value={templateMeta.name}
                  onChange={(e) => setTemplateMeta({ ...templateMeta, name: e.target.value })}
                  className="bg-transparent text-2xl font-semibold outline-none border-none focus:ring-0"
                  placeholder="Template name"
                  disabled={!canEdit}
                />
                <textarea
                  value={templateMeta.description}
                  onChange={(e) => setTemplateMeta({ ...templateMeta, description: e.target.value })}
                  className="bg-transparent text-sm text-slate-300 outline-none border-none focus:ring-0"
                  placeholder="Short description..."
                  disabled={!canEdit}
                  rows={2}
                />
                {branchOfficeId && canEdit && isOrgAdmin && (
                  <div className="text-xs text-slate-300 flex items-center gap-2">
                    Visibility:
                    <select
                      value={templateMeta.visibility}
                      onChange={(e) =>
                        setTemplateMeta({
                          ...templateMeta,
                          visibility: e.target.value as 'organization' | 'branch',
                        })
                      }
                      className="bg-slate-800 text-white text-xs rounded px-2 py-1"
                      disabled={!branchOfficeId}
                    >
                      <option value="branch">Branch Only</option>
                      <option value="organization">Organization-wide</option>
                    </select>
                  </div>
                )}
                {isBranchAdmin && branchOfficeId && (
              <p className="text-xs text-slate-400">
                Branch scope only for office {branchOfficeId.slice(0, 8)}…
              </p>
                )}
              </div>
              <div className="p-8 flex-1 space-y-4 bg-slate-50 overflow-y-auto">
                {draft.map((block, index) => (
                  <div
                    key={block.id}
                    className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm flex flex-col gap-3 group"
                  >
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={block.title}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev.map((s) =>
                              s.id === block.id ? { ...s, title: e.target.value } : s
                            )
                          )
                        }
                        className="text-sm font-bold text-slate-800 border-none focus:ring-0 w-full bg-transparent"
                        disabled={!canEdit}
                      />
                      {canEdit && (
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                          <button
                            onClick={() => moveBlock(index, 'up')}
                            className="p-2 text-slate-400 hover:text-brand bg-slate-50 hover:bg-brand/10 rounded-md transition-colors"
                          >
                            <ChevronUp size={16} />
                          </button>
                          <button
                            onClick={() => moveBlock(index, 'down')}
                            className="p-2 text-slate-400 hover:text-brand bg-slate-50 hover:bg-brand/10 rounded-md transition-colors"
                          >
                            <ChevronDown size={16} />
                          </button>
                          <div className="w-px h-5 bg-slate-200 mx-1"></div>
                          <button
                            onClick={() => handleDuplicate(block)}
                            className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-md transition-colors"
                          >
                            <Copy size={16} />
                          </button>
                          <button
                            onClick={() => handleRemove(block.id)}
                            className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                    <textarea
                      value={block.content}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev.map((s) =>
                            s.id === block.id ? { ...s, content: e.target.value } : s
                          )
                        )
                      }
                      className="w-full p-3 rounded-lg border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none bg-white text-sm min-h-[120px]"
                      placeholder="Clause language..."
                      disabled={!canEdit}
                    />
                    {canEdit && (
                      <label className="inline-flex items-center gap-2 text-xs text-slate-500">
                        <input
                          type="checkbox"
                          checked={block.required}
                          onChange={(e) =>
                            setDraft((prev) =>
                              prev.map((s) =>
                                s.id === block.id ? { ...s, required: e.target.checked } : s
                              )
                            )
                          }
                        />
                        Required clause
                      </label>
                    )}
                  </div>
                ))}

                {canEdit && (
                  <button
                    onClick={handleAddSection}
                    className="w-full py-4 border-2 border-dashed border-slate-300 text-slate-400 rounded-lg hover:border-brand hover:text-brand hover:bg-brand/5 transition-all flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wide group"
                  >
                    <Plus size={16} className="group-hover:scale-110 transition-transform" /> Add Clause
                  </button>
                )}
              </div>

              {canEdit && (
                <div className="border-t border-slate-200 p-5 flex items-center justify-between bg-slate-100">
                  <p className="text-xs text-slate-500">Templates update instantly for your team.</p>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 rounded-xl bg-brand text-white font-semibold flex items-center gap-2 disabled:opacity-60"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="animate-spin" size={16} /> Saving
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} /> Save Template
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/5 rounded-xl p-6 shadow-sm dark:shadow-lg space-y-4">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white mb-1">Live Preview</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Shows how the template renders in Agreement Studio.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-6 space-y-4 max-h-[700px] overflow-y-auto">
              <div className="text-center border-b border-slate-200 pb-4">
                <h3 className="text-lg font-semibold">{templateMeta.name || 'Untitled Template'}</h3>
                <p className="text-xs text-slate-500">{templateMeta.description || 'Preview of clause layout'}</p>
              </div>
              {draft.length === 0 ? (
                <p className="text-sm text-slate-500">Add clauses to see the preview.</p>
              ) : (
                draft.map((clause) => (
                  <div key={clause.id} className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
                      {clause.required ? 'Required Clause' : 'Optional Clause'}
                    </p>
                    <p className="text-sm font-semibold text-slate-800">{clause.title}</p>
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {clause.content || 'Clause body goes here...'}
                    </p>
                    <div className="h-px bg-slate-200"></div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateBuilder;
