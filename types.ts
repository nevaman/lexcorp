export enum AgreementStatus {
  DRAFT = 'Draft',
  REVIEW = 'Under Review',
  LEGAL_REVIEW = 'Legal Review',
  APPROVED = 'Approved',
  ACTIVE = 'Active',
  EXPIRED = 'Expired',
  ARCHIVED = 'Archived'
}

export enum RiskLevel {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High'
}

export type BillingPlan = 'monthly' | '1_year' | '2_year' | '5_year';

export interface Clause {
  id: string;
  title: string;
  content: string;
  type: 'standard' | 'modified' | 'custom';
  isException?: boolean;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  user: string;
  timestamp: string;
  details?: string;
}

export interface BrandSettings {
  primaryColor: string;
  fontFamily: string;
  companyName: string;
  logoUrl: string | null;
  tone: string;
}

export interface Agreement {
  id: string;
  title: string;
  counterparty: string;
  branchOfficeId?: string | null;
  department: string;
  owner: string;
  effectiveDate: string;
  renewalDate: string;
  value: number;
  riskLevel: RiskLevel;
  status: AgreementStatus;
  sections: Clause[];
  tags: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
  comments: Comment[];
  auditLog: AuditEvent[];
  notes?: string;
}

export interface Template {
  id: string;
  organization_id: string;
  branch_office_id?: string | null;
  name: string;
  description?: string | null;
  visibility: 'organization' | 'branch';
  sections: { id: string; title: string; content: string; required: boolean }[];
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  user_id: string;
  name: string;
  hq_location: string;
  plan: BillingPlan;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'org_admin' | 'branch_admin' | 'branch_user';
  branch_office_id?: string | null;
  department?: string | null;
  created_at: string;
}

export interface BranchInvite {
  id: string;
  organization_id: string;
  branch_office_id: string;
  email: string;
  role: 'branch_admin' | 'branch_user';
  full_name?: string | null;
  department?: string | null;
  title?: string | null;
  contact_email?: string | null;
  invite_token: string;
  status: 'pending' | 'accepted' | 'revoked';
  user_id?: string | null;
  created_at: string;
  accepted_at?: string | null;
}

export interface BranchOffice {
  id: string;
  organization_id: string;
  identifier: string;
  location: string;
  headcount?: number;
  created_at: string;
  updated_at: string;
}

export interface VendorDocument {
  id: string;
  name: string;
  url: string;
  uploaded_at: string;
  mime_type?: string | null;
}

export interface Vendor {
  id: string;
  organization_id: string;
  branch_office_id?: string | null;
  name: string;
  tin: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
  documents: VendorDocument[];
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export type ViewMode =
  | 'dashboard'
  | 'generator'
  | 'templates'
  | 'analytics'
  | 'settings'
  | 'offices'
  | 'departments'
  | 'vendors';