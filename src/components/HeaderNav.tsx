import React from 'react';
import { Navigation, AlertTriangle, BarChart3, Cpu, Satellite, ShieldCheck } from 'lucide-react';

interface HeaderNavProps {
  onOpenIcebergs: () => void;
  onOpenAnalytics: () => void;
  onOpenAIModel: () => void;
  onOpenMission: () => void;
  activeRouteTitle: string;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  onOpenIcebergs,
  onOpenAnalytics,
  onOpenAIModel,
  onOpenMission,
  activeRouteTitle
}) => {
  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-logo">
          <Navigation size={22} />
        </div>
        <div className="brand-text">
          <h1>PolarNav AI</h1>
          <span>NCPOR • Antarctic Navigation & Iceberg Trajectory Decision Support System</span>
        </div>
      </div>

      <div className="header-status-pills">
        <div className="status-pill">
          <div className="pulse-dot"></div>
          <span>SENTINEL-1 SAR: LIVE</span>
        </div>

        <div className="status-pill">
          <Satellite size={14} color="#00f2fe" />
          <span>AMSR2 ICE MESH: DAY +0</span>
        </div>
      </div>

      <div className="header-actions">
        <button className="btn-header" onClick={onOpenMission} style={{ borderColor: '#38ef7d', background: 'rgba(56, 239, 125, 0.1)' }}>
          <ShieldCheck size={15} color="#38ef7d" />
          <span style={{ color: '#38ef7d' }}>Mission Briefing</span>
        </button>

        <button className="btn-header" onClick={onOpenIcebergs}>
          <AlertTriangle size={15} color="#ff4b5c" />
          <span>Iceberg Monitor</span>
        </button>

        <button className="btn-header" onClick={onOpenAnalytics}>
          <BarChart3 size={15} color="#00f2fe" />
          <span>Route Analytics</span>
        </button>

        <button className="btn-header" onClick={onOpenAIModel}>
          <Cpu size={15} color="#38ef7d" />
          <span>AI Engine</span>
        </button>
      </div>
    </header>
  );
};
