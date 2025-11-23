import { supabase } from './supabaseClient';
import { BranchInvite } from '../types';

export const createBranchUserAccount = async (payload: {
  organizationId: string;
  branchOfficeId: string;
  email: string;
  inviteToken: string;
  fullName: string;
  department: string;
  title?: string;
}) => {
  const { data, error } = await supabase
    .from('branch_invites')
    .insert({
      organization_id: payload.organizationId,
      branch_office_id: payload.branchOfficeId,
      email: payload.email.toLowerCase(),
      contact_email: payload.email.toLowerCase(),
      invite_token: payload.inviteToken,
      role: 'branch_user',
      full_name: payload.fullName,
      department: payload.department,
      title: payload.title || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as BranchInvite;
};

export const fetchBranchUsersForOffice = async (branchOfficeId: string) => {
  const { data, error } = await supabase
    .from('branch_invites')
    .select('*')
    .eq('branch_office_id', branchOfficeId)
    .eq('role', 'branch_user')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as BranchInvite[];
};



