import { supabase } from './supabaseClient';
import { Project, ProjectStatus } from '../types';

type ProjectRow = {
  id: string;
  organization_id: string;
  branch_office_id: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const rowToProject = (row: ProjectRow): Project => ({
  id: row.id,
  organization_id: row.organization_id,
  branch_office_id: row.branch_office_id,
  name: row.name,
  description: row.description,
  status: row.status,
  start_date: row.start_date,
  end_date: row.end_date,
  created_by: row.created_by,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const fetchProjects = async (params: {
  organizationId: string;
  branchOfficeId?: string | null;
  scope?: 'all' | 'organization' | 'branch';
  statuses?: ProjectStatus[];
}): Promise<Project[]> => {
  let query = supabase
    .from('projects')
    .select('*')
    .eq('organization_id', params.organizationId)
    .order('created_at', { ascending: false });

  if (params.scope === 'branch') {
    if (params.branchOfficeId) {
      query = query.eq('branch_office_id', params.branchOfficeId);
    } else {
      query = query.not('branch_office_id', 'is', null);
    }
  } else if (params.scope === 'organization') {
    query = query.is('branch_office_id', null);
  } else if (params.branchOfficeId && params.scope !== 'all') {
    query = query.or(
      `branch_office_id.eq.${params.branchOfficeId},branch_office_id.is.null`
    );
  }

  if (params.statuses && params.statuses.length > 0) {
    query = query.in('status', params.statuses);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as ProjectRow[]).map(rowToProject);
};

export const createProject = async (payload: {
  organizationId: string;
  branchOfficeId?: string | null;
  name: string;
  description?: string;
  status?: ProjectStatus;
  startDate?: string;
  endDate?: string;
  createdBy?: string | null;
}): Promise<Project> => {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      organization_id: payload.organizationId,
      branch_office_id: payload.branchOfficeId ?? null,
      name: payload.name,
      description: payload.description ?? null,
      status: payload.status ?? 'active',
      start_date: payload.startDate ?? null,
      end_date: payload.endDate ?? null,
      created_by: payload.createdBy ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToProject(data as ProjectRow);
};

export const updateProject = async (
  id: string,
  updates: Partial<{
    name: string;
    description: string | null;
    status: ProjectStatus;
    branch_office_id: string | null;
    start_date: string | null;
    end_date: string | null;
  }>
): Promise<Project> => {
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return rowToProject(data as ProjectRow);
};

export const updateProjectStatus = async (
  id: string,
  status: ProjectStatus
): Promise<Project> => updateProject(id, { status });

import { Project, ProjectStatus } from '../types';
