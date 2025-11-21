import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import type { BillingPlan, Organization } from '../types';
import {
  fetchMembershipForUser,
  ensureMembership,
} from '../services/organizationService';

type AuthModeOrganizationPayload = {
  name: string;
  hqLocation: string;
  plan: BillingPlan;
};

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  organization: Organization | null;
  memberRole: 'org_admin' | 'branch_admin' | null;
  branchOfficeId: string | null;
  loading: boolean;
  actionLoading: boolean;
  isOrgAdmin: boolean;
  signIn: (payload: { email: string; password: string }) => Promise<void>;
  signUp: (payload: {
    email: string;
    password: string;
    organization: AuthModeOrganizationPayload;
  }) => Promise<{ requiresConfirmation: boolean }>;
  completeOrganizationProfile: (
    payload: AuthModeOrganizationPayload
  ) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const fetchOrganization = async (userId: string) => {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch organization', error);
    throw error;
  }

  return data as Organization | null;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [memberRole, setMemberRole] = useState<'org_admin' | 'branch_admin' | null>(null);
  const [branchOfficeId, setBranchOfficeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const hydrateMembership = async (userId?: string) => {
      if (!mounted) return;
      if (!userId) {
        setOrganization(null);
        setMemberRole(null);
        setBranchOfficeId(null);
        return;
      }
      try {
        const { organization: org, member } = await fetchMembershipForUser(userId);
        if (mounted) {
          setOrganization(org);
          setMemberRole(member?.role ?? null);
          setBranchOfficeId(member?.branch_office_id ?? null);
        }
        if (!org) {
          const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle<Organization>();
          if (!mounted) return;
          if (error) throw error;
          if (data) {
            await ensureMembership({
              userId,
              organizationId: data.id,
              role: 'org_admin',
            });
            setOrganization(data);
            setMemberRole('org_admin');
            setBranchOfficeId(null);
          }
        }
      } catch (err) {
        console.warn('Organization fetch failed', err);
        if (mounted) setOrganization(null);
        if (mounted) {
          setMemberRole(null);
          setBranchOfficeId(null);
        }
      }
    };

    const runInit = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted) return;
        const nextSession = data?.session ?? null;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        await hydrateMembership(nextSession?.user?.id);
      } catch (err) {
        console.error('Error initializing authentication', err);
        if (mounted) {
          setSession(null);
          setUser(null);
          setOrganization(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    runInit();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        hydrateMembership(nextSession.user.id);
      } else {
        setOrganization(null);
        setMemberRole(null);
        setBranchOfficeId(null);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // --- auth actions (same as before) ---
  const signIn: AuthContextValue['signIn'] = async ({ email, password }) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } finally {
      setActionLoading(false);
    }
  };

  const signUp: AuthContextValue['signUp'] = async ({
    email,
    password,
    organization: orgPayload,
  }) => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            typeof window !== 'undefined' ? window.location.origin : undefined,
          data: { role: 'org_admin' },
        },
      });
      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) throw new Error('Sign up succeeded but no user id returned.');

      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
          user_id: userId,
          name: orgPayload.name,
          hq_location: orgPayload.hqLocation,
          plan: orgPayload.plan,
        })
        .select()
        .single();

      if (orgError) throw orgError;
      if (data.session && data.user) {
        setOrganization(orgData as Organization);
        setMemberRole('org_admin');
        setBranchOfficeId(null);
        await ensureMembership({
          userId: data.user.id,
          organizationId: (orgData as Organization).id,
          role: 'org_admin',
        });
      }
      return { requiresConfirmation: !data.session };
    } finally {
      setActionLoading(false);
    }
  };

  const completeOrganizationProfile: AuthContextValue['completeOrganizationProfile'] =
    async (payload) => {
      if (!user) throw new Error('You must be signed in to complete organization setup.');
      setActionLoading(true);
      try {
        const { data, error } = await supabase
          .from('organizations')
          .upsert(
            {
              user_id: user.id,
              name: payload.name,
              hq_location: payload.hqLocation,
              plan: payload.plan,
            },
            { onConflict: 'user_id' }
          )
          .select()
          .single();
        if (error) throw error;
        const org = data as Organization;
        setOrganization(org);
        setMemberRole('org_admin');
        setBranchOfficeId(null);
        await ensureMembership({
          userId: user.id,
          organizationId: org.id,
          role: 'org_admin',
        });
      } finally {
        setActionLoading(false);
      }
    };

  const signOut: AuthContextValue['signOut'] = async () => {
    setActionLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setOrganization(null);
      setMemberRole(null);
      setBranchOfficeId(null);
    } finally {
      setActionLoading(false);
    }
  };

  const isOrgAdmin = memberRole === 'org_admin';

  const value: AuthContextValue = {
    session,
    user,
    organization,
    memberRole,
    branchOfficeId,
    loading,
    actionLoading,
    isOrgAdmin,
    signIn,
    signUp,
    completeOrganizationProfile,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
