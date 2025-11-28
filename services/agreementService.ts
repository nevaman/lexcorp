import { supabase } from './supabaseClient';
import { Agreement } from '../types';

type AgreementRow = {
  id: string;
  organization_id: string;
  branch_office_id: string | null;
  project_id: string | null;
  owner_user_id: string | null;
  title: string;
  counterparty: string;
  department: string | null;
  owner: string | null;
  effective_date: string | null;
  renewal_date: string | null;
  value: number | null;
  risk_level: string;
  status: string;
  sections: any;
  tags: string[] | null;
  version: number | null;
  comments: any;
  audit_log: any;
  created_at: string;
  updated_at: string;
};

const rowToAgreement = (row: AgreementRow): Agreement => ({
  id: row.id,
  title: row.title,
  counterparty: row.counterparty || '',
  branchOfficeId: row.branch_office_id || null,
  projectId: row.project_id || null,
  department: row.department || '',
  owner: row.owner || '',
  effectiveDate: row.effective_date || '',
  renewalDate: row.renewal_date || '',
  value: row.value ?? 0,
  riskLevel: row.risk_level as Agreement['riskLevel'],
  status: row.status as Agreement['status'],
  sections: row.sections ?? [],
  tags: row.tags ?? [],
  version: row.version ?? 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  comments: row.comments ?? [],
  auditLog: row.audit_log ?? [],
});

export const fetchAgreementsForOrganization = async (
  organizationId: string,
  options?: { branchOfficeId?: string | null; projectId?: string | null }
): Promise<Agreement[]> => {
  if (!organizationId) return [];

  let query = supabase
    .from('agreements')
    .select('*')
    .eq('organization_id', organizationId);

  if (options?.branchOfficeId) {
    query = query.eq('branch_office_id', options.branchOfficeId);
  }

  if (options?.projectId) {
    query = query.eq('project_id', options.projectId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;

  return (data as AgreementRow[]).map(rowToAgreement);
};

export const upsertAgreementForOrganization = async (
  agreement: Agreement,
  organizationId: string,
  ownerUserId?: string | null
): Promise<Agreement> => {
  const payload = {
    id: agreement.id,
    organization_id: organizationId,
    owner_user_id: ownerUserId ?? null,
    branch_office_id: agreement.branchOfficeId ?? null,
    project_id: agreement.projectId ?? null,
    title: agreement.title,
    counterparty: agreement.counterparty,
    department: agreement.department,
    owner: agreement.owner,
    effective_date: agreement.effectiveDate || null,
    renewal_date: agreement.renewalDate || null,
    value: agreement.value ?? 0,
    risk_level: agreement.riskLevel,
    status: agreement.status,
    sections: agreement.sections ?? [],
    tags: agreement.tags ?? [],
    version: agreement.version ?? 1,
    comments: agreement.comments ?? [],
    audit_log: agreement.auditLog ?? [],
  };

  const { data, error } = await supabase
    .from('agreements')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;

  return rowToAgreement(data as AgreementRow);
};

export const fetchAgreementsForProject = async (
  organizationId: string,
  projectId: string
): Promise<Agreement[]> => {
  return fetchAgreementsForOrganization(organizationId, { projectId });
};
