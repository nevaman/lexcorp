import { supabase } from './supabaseClient';
import {
  Organization,
  OrganizationMember,
  BranchInvite,
} from '../types';

type MembershipRow = {
  id: string;
  role: 'org_admin' | 'branch_admin' | 'branch_user';
  branch_office_id: string | null;
  organization_id: string;
  department: string | null;
  organizations: Organization;
};

export const fetchMembershipForUser = async (
  userId: string
): Promise<{ organization: Organization | null; member: OrganizationMember | null }> => {
  const { data, error } = await supabase
    .from('organization_members')
    .select('id, role, branch_office_id, organization_id, department, created_at, organizations(*)')
    .eq('user_id', userId)
    .maybeSingle<MembershipRow>();

  if (error) {
    console.error('Failed to fetch membership', error);
    throw error;
  }

  if (!data) {
    return { organization: null, member: null };
  }

  const member: OrganizationMember = {
    id: data.id,
    organization_id: data.organization_id,
    user_id: userId,
    role: data.role,
    branch_office_id: data.branch_office_id,
    department: data.department,
    created_at: data.organizations?.created_at || new Date().toISOString(),
  };

  return { organization: data.organizations, member };
};

export const ensureMembership = async (payload: {
  userId: string;
  organizationId: string;
  role: 'org_admin' | 'branch_admin' | 'branch_user';
  branchOfficeId?: string | null;
  department?: string | null;
}) => {
  const { data, error } = await supabase
    .from('organization_members')
    .upsert(
      {
        user_id: payload.userId,
        organization_id: payload.organizationId,
        role: payload.role,
        branch_office_id: payload.branchOfficeId ?? null,
        department: payload.department ?? null,
      },
      { onConflict: 'user_id,organization_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as OrganizationMember;
};

export const createBranchInvite = async (payload: {
  organizationId: string;
  branchOfficeId: string;
  email: string;
  inviteToken: string;
  role: 'branch_admin' | 'branch_user';
  fullName?: string;
  department?: string;
  title?: string;
}) => {
  const { data, error } = await supabase
    .from('branch_invites')
    .insert({
      organization_id: payload.organizationId,
      branch_office_id: payload.branchOfficeId,
      email: payload.email,
      invite_token: payload.inviteToken,
      role: payload.role,
      full_name: payload.fullName || null,
      department: payload.department || null,
      title: payload.title || null,
      contact_email: payload.email,
    })
    .select()
    .single();

  if (error) throw error;
  return data as BranchInvite;
};

export const fetchBranchInvites = async (
  branchOfficeId: string,
  roleFilter?: 'branch_admin' | 'branch_user'
) => {
  let request = supabase
    .from('branch_invites')
    .select('*')
    .eq('branch_office_id', branchOfficeId);

  if (roleFilter) {
    request = request.eq('role', roleFilter);
  }

  const { data, error } = await request.order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as BranchInvite[];
};

export const fetchInviteByToken = async (
  token: string
): Promise<
  (BranchInvite & {
    branch_offices: { id: string; identifier: string; location: string };
    organizations: Organization;
  }) | null
> => {
  const { data, error } = await supabase
    .from('branch_invites')
    .select(
      '*, branch_offices(id, identifier, location), organizations(id, name, hq_location, plan, created_at, updated_at)'
    )
    .eq('invite_token', token)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const markInviteAccepted = async (inviteId: string, userId: string) => {
  const { data, error } = await supabase
    .from('branch_invites')
    .update({
      status: 'accepted',
      user_id: userId,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', inviteId)
    .select()
    .single();

  if (error) throw error;
  return data as BranchInvite;
};

