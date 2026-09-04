import React from 'react';
import { MissionAssessment } from '../explain/missionAssessment';
import { ShieldAlert, ShieldCheck, AlertTriangle, X, Anchor, Compass, Clock, Fuel, CheckCircle, Info } from 'lucide-react';

interface MissionAssessmentPanelProps {
  assessment: MissionAssessment;
  onClose: () => void;
}

export const MissionAssessmentPanel: React.FC<MissionAssessmentPanelProps> = ({ assessment, onClose }) => {
  const getStatusBadge = () => {
    switch (assessment.overallStatus) {
      case 'FEASIBLE':
        return (
          <div className="status-badge safe" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', background: 'rgba(56, 239, 125, 0.15)', color: '#38ef7d', border: '1px solid rgba(56, 239, 125, 0.3)', fontWeight: 600 }}>
            <ShieldCheck size={18} /> MISSION FEASIBLE
          </div>
        );
      case 'CAUTION':
        return (
          <div className="status-badge warning" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', background: 'rgba(255, 183, 3, 0.15)', color: '#ffb703', border: '1px solid rgba(255, 183, 3, 0.3)', fontWeight: 600 }}>
            <AlertTriangle size={18} /> CAUTION REQUIRED
          </div>
        );
      case 'UNSAFE':
        return (
          <div className="status-badge danger" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', background: 'rgba(255, 75, 75, 0.15)', color: '#ff4b4b', border: '1px solid rgba(255, 75, 75, 0.3)', fontWeight: 600 }}>
            <ShieldAlert size={18} /> UNSAFE MISSION
          </div>
        );
    }
  };

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(10, 15, 30, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="modal-content glass-card" style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(0, 242, 254, 0.2)', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Compass style={{ color: '#00f2fe' }} /> Polar Expedition Safety Assessment
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Dynamic AI Evaluation for {assessment.vesselName} ({assessment.polarClass})
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Status Banner */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assessment Status</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
              {assessment.originName} → {assessment.destinationName}
            </div>
          </div>
          {getStatusBadge()}
        </div>

        {/* Key Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}><Compass size={12}/> Distance</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#00f2fe', marginTop: '4px' }}>{assessment.distanceNmi} <span style={{ fontSize: '0.7rem' }}>nmi</span></div>
          </div>

          <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12}/> Transit Time</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>{assessment.estimatedTimeHours} <span style={{ fontSize: '0.7rem' }}>hrs</span></div>
          </div>

          <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}><Fuel size={12}/> Fuel Est.</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>{assessment.estimatedFuelTons} <span style={{ fontSize: '0.7rem' }}>tons</span></div>
          </div>

          <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}><ShieldCheck size={12}/> Safety Index</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: assessment.safetyScoreTotal > 80 ? '#38ef7d' : '#ffb703', marginTop: '4px' }}>{assessment.safetyScoreTotal}/100</div>
          </div>
        </div>

        {/* Warnings / Operational Notes */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
            Risk Warnings & Safety Diagnostics ({assessment.activeWarnings.length})
          </h4>
          {assessment.activeWarnings.length === 0 ? (
            <div style={{ background: 'rgba(56, 239, 125, 0.05)', border: '1px solid rgba(56, 239, 125, 0.2)', padding: '12px', borderRadius: '8px', color: '#38ef7d', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={16} /> All safety criteria met. Safe clearance maintained from tracked hazards.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {assessment.activeWarnings.map((warn, idx) => (
                <div key={idx} style={{ background: 'rgba(255, 75, 75, 0.08)', border: '1px solid rgba(255, 75, 75, 0.2)', padding: '10px 14px', borderRadius: '8px', color: '#ff4b4b', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                  <span>{warn}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Forecast Confidence */}
        <div style={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '14px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600 }}>Trajectory Forecast Confidence</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Day +{assessment.forecastDay} PINN Ocean Current Drift Model</div>
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: assessment.predictionConfidencePct > 80 ? '#38ef7d' : '#ffb703' }}>
            {assessment.predictionConfidencePct}%
          </div>
        </div>

      </div>
    </div>
  );
};
