import React from 'react';
import {
  LayoutDashboard,
  FilePlus,
  FileText,
  BarChart3,
  Settings,
  Sparkles,
  Sun,
  Moon,
  LogOut,
  Building2,
  Briefcase,
  Store,
} from './ui/Icons';
import { ViewMode } from '../types';

interface SidebarProps {
  currentView: ViewMode;
  setView: (view: ViewMode) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  organizationName?: string | null;
  userEmail?: string | null;
  onSignOut?: () => void;
  signingOut?: boolean;
  isOrgAdmin?: boolean;
  memberRole?: 'org_admin' | 'branch_admin' | 'branch_user' | null;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setView,
  isDarkMode,
  toggleTheme,
  organizationName,
  userEmail,
  onSignOut,
  signingOut,
  isOrgAdmin,
  memberRole,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'generator', label: 'Drafting Studio', icon: FilePlus },
    { id: 'templates', label: 'Template Builder', icon: FileText },
    { id: 'analytics', label: 'Intelligence', icon: BarChart3 },
    ...(isOrgAdmin || memberRole === 'branch_admin'
      ? [{ id: 'vendors', label: 'Vendors', icon: Store }]
      : []),
    { id: 'settings', label: 'Brand Settings', icon: Settings },
    ...(isOrgAdmin
      ? [{ id: 'offices', label: 'Office Network', icon: Building2 }]
      : []),
    ...(memberRole === 'branch_admin'
      ? [{ id: 'departments', label: 'Branch Team', icon: Briefcase }]
      : []),
  ];

  return (
    <div className="w-72 bg-white/95 dark:bg-[#020617]/95 backdrop-blur-xl flex flex-col h-screen fixed left-0 top-0 border-r border-slate-200 dark:border-white/5 shadow-2xl z-50 transition-colors duration-300">
      {/* Logo Area */}
      <div className="p-8 flex items-center gap-3">
        <div className="relative w-10 h-10 flex items-center justify-center">
            <div className="absolute inset-0 bg-brand/20 blur-md rounded-full opacity-50 dark:opacity-100"></div>
            <div className="relative w-full h-full bg-gradient-to-br from-brand to-amber-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-brand/20">
                <Sparkles size={20} fill="currentColor" className="text-white" />
            </div>
        </div>
        <div>
            <span className="text-slate-900 dark:text-white font-bold text-xl tracking-tight block font-['Outfit']">LexCorp</span>
            <span className="text-[10px] text-brand font-medium tracking-widest uppercase">Enterprise</span>
        </div>
      </div>

      <div className="px-6 mb-6">
        <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent"></div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id as ViewMode)}
              className={`group w-full flex items-center gap-3 px-4 py-3.5 rounded-lg transition-all duration-300 relative overflow-hidden ${
                isActive
                  ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-transparent'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5'
              }`}
            >
              {/* Active Background Glow for Dark Mode */}
              {isActive && (
                <div className="absolute inset-0 dark:bg-gradient-to-r dark:from-brand/10 dark:to-transparent border-l-[3px] border-brand"></div>
              )}
              
              <Icon 
                size={20} 
                className={`relative z-10 transition-colors ${isActive ? 'text-brand' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} 
              />
              <span className={`relative z-10 font-medium text-sm tracking-wide ${isActive ? 'font-semibold' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="p-6 border-t border-slate-200 dark:border-white/5 space-y-4">
        {/* Theme Toggle */}
        <div className="bg-slate-100 dark:bg-white/5 p-1 rounded-lg flex">
            <button 
                onClick={() => !isDarkMode && toggleTheme()} 
                className={`flex-1 py-1.5 rounded flex items-center justify-center gap-2 text-xs font-bold transition-all ${!isDarkMode ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-300'}`}
            >
                <Sun size={14} /> Light
            </button>
            <button 
                onClick={() => isDarkMode && toggleTheme()} 
                className={`flex-1 py-1.5 rounded flex items-center justify-center gap-2 text-xs font-bold transition-all ${isDarkMode ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <Moon size={14} /> Dark
            </button>
        </div>

        <div className="flex items-center gap-3 px-4">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse"></div>
            <div className="text-xs text-slate-500 font-mono">System Operational</div>
        </div>

        {(organizationName || userEmail) && (
          <div className="mt-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Organization</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {organizationName || 'Unassigned'}
              </p>
              {userEmail && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{userEmail}</p>}
            </div>
            {onSignOut && (
              <button
                onClick={onSignOut}
                disabled={signingOut}
                className="p-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 hover:text-brand hover:border-brand/40 transition disabled:opacity-50"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;