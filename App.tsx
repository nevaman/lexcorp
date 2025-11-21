import React, { useState, useEffect, useCallback } from 'react';
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
  } = useAuth();
  const [view, setView] = useState<ViewMode>('dashboard');
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [agreementsLoading, setAgreementsLoading] = useState(false);
  const [agreementsError, setAgreementsError] = useState<string | null>(null);
  const [editingAgreement, setEditingAgreement] = useState<Agreement | undefined>(undefined);
  
  const [brandSettings, setBrandSettings] = useState<BrandSettings>({
    companyName: 'LexCorp',
    primaryColor: '#f97316',
    fontFamily: 'DM Sans',
    logoUrl: null,
    tone: 'Professional, firm, and concise.'
  });

  const handleSignOut = () => {
    signOut().catch((err) => console.error('Sign out failed', err));
  };

  const refreshAgreements = useCallback(async () => {
    if (!organization?.id) {
      setAgreements([]);
      return;
    }
    setAgreementsLoading(true);
    setAgreementsError(null);
    try {
      const data = await fetchAgreementsForOrganization(organization.id);
      setAgreements(data);
    } catch (err) {
      console.error('Failed to load agreements', err);
      setAgreementsError('Unable to load agreements right now.');
    } finally {
      setAgreementsLoading(false);
    }
  }, [organization?.id]);

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
      const safeView =
        parsedView === 'offices' && !isOrgAdmin ? DEFAULT_VIEW : parsedView;
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
  }, [isOrgAdmin]);

  const navigateTo = useCallback(
    (targetView: ViewMode) => {
      const nextView =
        targetView === 'offices' && !isOrgAdmin ? DEFAULT_VIEW : targetView;
      setView(nextView);
      setInviteToken(null);
      if (typeof window !== 'undefined') {
        const targetHash = buildHashFromView(nextView);
        if (window.location.hash !== targetHash) {
          window.location.hash = targetHash;
        }
      }
    },
    [isOrgAdmin]
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
      />
      <main className="flex-1 ml-72 h-screen overflow-auto scrollbar-hide bg-gradient-to-br from-slate-50 to-slate-100 dark:from-[#020617] dark:to-[#0f172a]">
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