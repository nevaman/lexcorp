import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import DocumentManager from './views/DocumentManager';
import AgreementGenerator from './views/AgreementGenerator';
import TemplateBuilder from './views/TemplateBuilder';
import AnalyticsView from './views/AnalyticsView';
import SettingsView from './views/SettingsView';
import OfficeManager from './views/OfficeManager';
import OrganizationProfile from './views/OrganizationProfile';
import AuthLanding from './views/AuthLanding';
import BranchInvite from './views/BranchInvite';
import BranchUserManager from './views/BranchUserManager';
import VendorManager from './views/VendorManager';
import ProjectManager from './views/ProjectManager';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import {
  fetchAgreementsForOrganization,
  upsertAgreementForOrganization,
} from './services/agreementService';
import {
  ViewMode,
  Agreement,
  BrandSettings,
} from './types';

const ROUTABLE_VIEWS: ViewMode[] = [
  'dashboard',
  'generator',
  'templates',
  'analytics',
  'settings',
  'offices',
  'vendors',
  'projects',
  'departments',
];

const DEFAULT_VIEW: ViewMode = 'dashboard';

const buildHashFromView = (view: ViewMode) => `#/${view}`;

const parseHashToView = (hash: string): ViewMode => {
  if (!hash) return DEFAULT_VIEW;
  const cleaned = hash.replace(/^#\/?/, '');
  const candidate = cleaned || DEFAULT_VIEW;
  return ROUTABLE_VIEWS.includes(candidate as ViewMode)
    ? (candidate as ViewMode)
    : DEFAULT_VIEW;
};

const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white gap-4">
    <div className="w-16 h-16 border-4 border-brand/30 border-t-brand rounded-full animate-spin"></div>
    <p className="text-sm tracking-[0.4em] uppercase text-white/70">
      Initializing workspace
    </p>
  </div>
);

const AppShell: React.FC = () => {
  const {
    loading,
    session,
    organization,
    user,
    signOut,
    actionLoading,
    isOrgAdmin,
    memberRole,
    branchOfficeId,
  } = useAuth();
  const [view, setView] = useState<ViewMode>('dashboard');
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [agreementsLoading, setAgreementsLoading] = useState(false);
  const [agreementsError, setAgreementsError] = useState<string | null>(null);
  const [editingAgreement, setEditingAgreement] = useState<Agreement | undefined>(undefined);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 1400;
  });
  const autoCollapseRef = useRef<boolean>(sidebarCollapsed);
  
  const [brandSettings, setBrandSettings] = useState<BrandSettings>({
    companyName: 'LexCorp',
    primaryColor: '#f97316',
    fontFamily: 'DM Sans',
    logoUrl: null,
    tone: 'Professional, firm, and concise.'
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResponsiveSidebar = () => {
      const shouldAutoCollapse = window.innerWidth <= 1400;
      if (shouldAutoCollapse && !autoCollapseRef.current) {
        autoCollapseRef.current = true;
        setSidebarCollapsed(true);
      } else if (!shouldAutoCollapse && autoCollapseRef.current) {
        autoCollapseRef.current = false;
        setSidebarCollapsed(false);
      }
    };

    handleResponsiveSidebar();
    window.addEventListener('resize', handleResponsiveSidebar);
    return () => window.removeEventListener('resize', handleResponsiveSidebar);
  }, []);

  const handleSidebarToggle = useCallback(() => {
    autoCollapseRef.current = false;
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const handleSignOut = () => {
    signOut().catch((err) => console.error('Sign out failed', err));
  };
  const isBranchAdmin = memberRole === 'branch_admin';
  const isBranchUser = memberRole === 'branch_user';

  const enforceViewAccess = useCallback(
    (targetView: ViewMode) => {
      if (targetView === 'offices' && !isOrgAdmin) return DEFAULT_VIEW;
      if (targetView === 'departments' && !isBranchAdmin) return DEFAULT_VIEW;
      if (
        targetView === 'vendors' &&
        !(isOrgAdmin || isBranchAdmin)
      )
        return DEFAULT_VIEW;
      if (
        targetView === 'projects' &&
        !(isOrgAdmin || isBranchAdmin)
      )
        return DEFAULT_VIEW;
      return targetView;
    },
    [isOrgAdmin, isBranchAdmin]
  );

  const refreshAgreements = useCallback(async () => {
    if (!organization?.id) {
      setAgreements([]);
      return;
    }
    setAgreementsLoading(true);
    setAgreementsError(null);
    try {
      const filter = !isOrgAdmin && branchOfficeId ? { branchOfficeId } : undefined;
      const data = await fetchAgreementsForOrganization(organization.id, filter);
      setAgreements(data);
    } catch (err) {
      console.error('Failed to load agreements', err);
      setAgreementsError('Unable to load agreements right now.');
    } finally {
      setAgreementsLoading(false);
    }
  }, [organization?.id, isOrgAdmin, branchOfficeId]);

  useEffect(() => {
    refreshAgreements();
  }, [refreshAgreements]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ensureDefaultHash = () => {
      if (!window.location.hash) {
        window.location.hash = buildHashFromView(DEFAULT_VIEW);
      }
    };
    const handleHashChange = () => {
      const rawHash = window.location.hash;
      if (rawHash.startsWith('#/invite/')) {
        const token = rawHash.split('/')[2] || null;
        setInviteToken(token);
        return;
      }
      setInviteToken(null);
      const parsedView = parseHashToView(rawHash);
      const safeView = enforceViewAccess(parsedView);
      setView(safeView);
      if (safeView !== parsedView) {
        const correctedHash = buildHashFromView(safeView);
        if (window.location.hash !== correctedHash) {
          window.location.hash = correctedHash;
        }
      }
    };

    ensureDefaultHash();
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [enforceViewAccess]);

  const navigateTo = useCallback(
    (targetView: ViewMode) => {
      const nextView = enforceViewAccess(targetView);
      setView(nextView);
      setInviteToken(null);
      if (typeof window !== 'undefined') {
        const targetHash = buildHashFromView(nextView);
        if (window.location.hash !== targetHash) {
          window.location.hash = targetHash;
        }
      }
    },
    [enforceViewAccess]
  );

  // Apply theme to HTML element
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Apply brand color to CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--brand-color',
      brandSettings.primaryColor
    );
  }, [brandSettings.primaryColor]);

  const handleSaveAgreement = async (agreement: Agreement) => {
    if (!organization?.id) return;
    try {
      const saved = await upsertAgreementForOrganization(
        agreement,
        organization.id,
        user?.id
      );
      setAgreements(prev => {
        const exists = prev.some(a => a.id === saved.id);
        if (exists) {
          return prev.map(a => (a.id === saved.id ? saved : a));
        }
        return [saved, ...prev];
      });
      setEditingAgreement(undefined);
      navigateTo('dashboard');
    } catch (err) {
      console.error('Failed to save agreement', err);
      alert('Failed to save agreement. Please try again.');
    }
  };

  const handleOpenAgreement = (agreement: Agreement) => {
    setEditingAgreement(agreement);
    navigateTo('generator');
  };

  const handleCreateNew = () => {
    setEditingAgreement(undefined);
    navigateTo('generator');
  };

  const handleSidebarNavigate = (nextView: ViewMode) => {
    if (nextView === 'generator') {
      handleCreateNew();
    } else {
      navigateTo(nextView);
    }
  };

  const renderContent = () => {
    switch (view) {
      case 'dashboard':
        if (agreementsLoading) {
          return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
              <div className="w-10 h-10 border-4 border-brand/30 border-t-brand rounded-full animate-spin"></div>
              <p className="text-sm uppercase tracking-[0.4em]">Loading Agreements</p>
            </div>
          );
        }
        if (agreementsError) {
          return (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <p className="text-slate-500">{agreementsError}</p>
              <button
                onClick={refreshAgreements}
                className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand/90"
              >
                Retry
              </button>
            </div>
          );
        }
        return (
          <DocumentManager 
            agreements={agreements} 
            onOpenAgreement={handleOpenAgreement} 
          />
        );
      case 'generator':
        return (
          <AgreementGenerator 
            onSave={handleSaveAgreement} 
            onBack={() => navigateTo('dashboard')}
            initialData={editingAgreement}
            brandSettings={brandSettings}
          />
        );
      case 'templates':
        return <TemplateBuilder />;
      case 'analytics':
        return <AnalyticsView agreements={agreements} />;
      case 'settings':
        return (
          <SettingsView settings={brandSettings} onSave={setBrandSettings} />
        );
      case 'offices':
        return isOrgAdmin ? <OfficeManager /> : (
          <DocumentManager
            agreements={agreements}
            onOpenAgreement={handleOpenAgreement}
          />
        );
      case 'departments':
        return isBranchAdmin ? <BranchUserManager /> : (
          <DocumentManager
            agreements={agreements}
            onOpenAgreement={handleOpenAgreement}
          />
        );
      case 'vendors':
        return (isOrgAdmin || isBranchAdmin)
          ? <VendorManager />
          : (
            <DocumentManager
              agreements={agreements}
              onOpenAgreement={handleOpenAgreement}
            />
          );
      case 'projects':
        return (isOrgAdmin || isBranchAdmin)
          ? <ProjectManager brandSettings={brandSettings} />
          : (
            <DocumentManager
              agreements={agreements}
              onOpenAgreement={handleOpenAgreement}
            />
          );
      default:
        return (
          <DocumentManager
            agreements={agreements}
            onOpenAgreement={handleOpenAgreement}
          />
        );
    }
  };

  if (inviteToken) {
    return <BranchInvite token={inviteToken} />;
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <AuthLanding />;
  }

  if (session && !organization) {
    return <OrganizationProfile />;
  }

  return (
    <div
      className={`flex min-h-screen transition-colors duration-300 font-sans selection:bg-brand selection:text-white ${
        isDarkMode ? 'bg-[#020617] text-slate-200' : 'bg-slate-50 text-slate-900'
      }`}
    >
          <Sidebar 
        currentView={view} 
        setView={handleSidebarNavigate}
        isDarkMode={isDarkMode}
        toggleTheme={() => setIsDarkMode(!isDarkMode)}
        organizationName={organization?.name}
        userEmail={user?.email}
        onSignOut={handleSignOut}
        signingOut={actionLoading}
        isOrgAdmin={isOrgAdmin}
        memberRole={memberRole}
            collapsed={sidebarCollapsed}
            onToggleCollapse={handleSidebarToggle}
      />
      <main
        className={`flex-1 ${
          sidebarCollapsed ? 'ml-24' : 'ml-72'
        } h-screen overflow-auto scrollbar-hide bg-gradient-to-br from-slate-50 to-slate-100 dark:from-[#020617] dark:to-[#0f172a] transition-all duration-300`}
      >
        {renderContent()}
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <AppShell />
  </AuthProvider>
);

export default App;