import React from 'react';
import { LayoutDashboard, FileText, Settings, Monitor, Mic } from 'lucide-react';

export type TabType = 'dashboard' | 'notes' | 'settings';

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  noteCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  noteCount,
}) => {
  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <div
          className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => onTabChange('dashboard')}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </div>

        <div
          className={`nav-item ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => onTabChange('notes')}
        >
          <FileText size={18} />
          <span>My Notes ({noteCount})</span>
        </div>

        <div
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => onTabChange('settings')}
        >
          <Settings size={18} />
          <span>Settings</span>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="stats-card">
          <div className="stats-title">Desktop Engine</div>
          <div className="stats-row">
            <span>Target OS</span>
            <span className="stats-val" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Monitor size={13} /> Windows x64
            </span>
          </div>
          <div className="stats-row">
            <span>Audio Pipeline</span>
            <span className="stats-val" style={{ color: '#14B8A6', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Mic size={13} /> Active / Ready
            </span>
          </div>
          <div className="stats-row">
            <span>Total Notes</span>
            <span className="stats-val">{noteCount}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
