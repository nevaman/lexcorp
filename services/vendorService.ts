import { supabase } from './supabaseClient';
import { Vendor, VendorDocument } from '../types';

type VendorRow = {
  id: string;
  organization_id: string;
  branch_office_id: string | null;
  name: string;
  tin: string;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  documents: any;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const rowToVendor = (row: VendorRow): Vendor => ({
  id: row.id,
  organization_id: row.organization_id,
  branch_office_id: row.branch_office_id,
  name: row.name,
  tin: row.tin,
  contact_email: row.contact_email,
  contact_phone: row.contact_phone,
  notes: row.notes,
  documents: Array.isArray(row.documents)
    ? (row.documents as VendorDocument[])
    : [],
  created_by: row.created_by,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const fetchVendors = async (params: {
  organizationId: string;
  branchOfficeId?: string | null;
  scope?: 'all' | 'organization' | 'branch';
}): Promise<Vendor[]> => {
  let query = supabase
    .from('vendors')
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

  const { data, error } = await query;
  if (error) throw error;
  return (data as VendorRow[]).map(rowToVendor);
};

export const createVendor = async (payload: {
  organizationId: string;
  branchOfficeId?: string | null;
  name: string;
  tin: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  documents?: VendorDocument[];
  createdBy?: string | null;
}): Promise<Vendor> => {
  const { data, error } = await supabase
    .from('vendors')
    .insert({
      organization_id: payload.organizationId,
      branch_office_id: payload.branchOfficeId ?? null,
      name: payload.name,
      tin: payload.tin,
      contact_email: payload.contactEmail ?? null,
      contact_phone: payload.contactPhone ?? null,
      notes: payload.notes ?? null,
      documents: payload.documents ?? [],
      created_by: payload.createdBy ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToVendor(data as VendorRow);
};

export const updateVendor = async (
  id: string,
  updates: Partial<{
    name: string;
    tin: string;
    contact_email: string | null;
    contact_phone: string | null;
    notes: string | null;
    branch_office_id: string | null;
  }>
): Promise<Vendor> => {
  const { data, error } = await supabase
    .from('vendors')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return rowToVendor(data as VendorRow);
};

export const updateVendorDocuments = async (
  id: string,
  documents: VendorDocument[]
): Promise<Vendor> => {
  const { data, error } = await supabase
    .from('vendors')
    .update({ documents })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return rowToVendor(data as VendorRow);
};

export const deleteVendor = async (id: string) => {
  const { error } = await supabase.from('vendors').delete().eq('id', id);
  if (error) throw error;
};

const FUNCTIONS_BASE =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
    : '';

export const uploadVendorDocument = async (params: {
  vendorId: string;
  file: File;
}): Promise<{ path: string; url: string }> => {
  if (!FUNCTIONS_BASE) {
    throw new Error('Supabase Functions URL is not configured.');
  }
  const formData = new FormData();
  formData.append('vendorId', params.vendorId);
  formData.append('file', params.file);

  const response = await fetch(`${FUNCTIONS_BASE}/upload-vendor-document`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      message || 'Unable to upload vendor document. Please try again.'
    );
  }

  return response.json();
};
