import React from 'react';
import { ShieldCheck, Anchor, Target, AlertTriangle, AlertCircle, Info, InfoIcon } from 'lucide-react';
import { MissionAssessment } from '../explain/missionAssessment';

interface MissionAssessmentPanelProps {
  assessment: MissionAssessment;
  onClose: () => void;
}

export const MissionAssessmentPanel: React.FC<MissionAssessmentPanelProps> = ({ assessment, onClose }) => {
  const getStatusColor = (status: 'FEASIBLE' | 'CAUTION' | 'UNSAFE') => {
    switch (status) {
      case 'FEASIBLE': return '#38ef7d';
      case 'CAUTION': return '#ffb703';
      case 'UNSAFE': return '#ff4b5c';
      default: return '#8b9bb4';
    }
  };

  const getStatusIcon = (status: 'FEASIBLE' | 'CAUTION' | 'UNSAFE') => {
    switch (status) {
      case 'FEASIBLE': return <ShieldCheck size={28} color="#38ef7d" />;
      case 'CAUTION': return <AlertTriangle size={28} color="#ffb703" />;
      case 'UNSAFE': return <AlertCircle size={28} color="#ff4b5c" />;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <Target size={20} color="#00f2fe" /> Expedition Mission Assessment
          </h2>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Top Status Banner */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '16px', 
              padding: '20px', 
              background: `rgba(${assessment.overallStatus === 'UNSAFE' ? '255, 75, 92' : assessment.overallStatus === 'CAUTION' ? '255, 183, 3' : '56, 239, 125'}, 0.1)`, 
              border: `1px solid ${getStatusColor(assessment.overallStatus)}`, 
              borderRadius: '10px',
              marginBottom: '24px'
            }}
          >
            {getStatusIcon(assessment.overallStatus)}
            <div>
              <div style={{ fontSize: '0.85rem', color: '#8b9bb4', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Overall Operational Status
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 600, color: getStatusColor(assessment.overallStatus), marginTop: '4px' }}>
                {assessment.overallStatus}
              </div>
            </div>
          </div>

          <div className="grid-3" style={{ marginBottom: '24px' }}>
            <div className="metric-box">
              <div className="metric-title">Vessel Profile</div>
              <div className="metric-num">{assessment.vesselName}</div>
              <div className="metric-sub" style={{ color: '#00f2fe' }}>Class: {assessment.polarClass}</div>
            </div>

            <div className="metric-box">
              <div className="metric-title">Voyage Trajectory</div>
              <div className="metric-num">
                {assessment.originName.split(' ')[0]} → {assessment.destinationName.split(' ')[0]}
              </div>
              <div className="metric-sub">{assessment.distanceNmi.toFixed(0)} Nmi | ETA: {(assessment.estimatedTimeHours/24).toFixed(1)} Days</div>
            </div>

            <div className="metric-box">
              <div className="metric-title">Forecast Logistics</div>
              <div className="metric-num" style={{ color: '#ffb703' }}>
                {assessment.estimatedFuelTons} Tons MGO
              </div>
              <div className="metric-sub">Forecast Horizon: T+{assessment.forecastDay} Days</div>
            </div>
          </div>

          {/* Environmental Hazards */}
          <h4 style={{ color: '#00f2fe', marginBottom: '12px' }}>Environmental Hazard Telemetry</h4>
          <table className="data-table">
            <thead>
              <tr>
                <th>Risk Vector</th>
                <th>Measured Parameter</th>
                <th>Safety Constraint</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Sea-Ice Concentration (SIC)</strong></td>
                <td>{assessment.minSicPct}% – {assessment.maxSicPct}% Coverage</td>
                <td>
                  <span className={`badge ${assessment.maxSicPct > 80 ? 'badge-red' : assessment.maxSicPct > 50 ? 'badge-amber' : 'badge-green'}`}>
                    {assessment.maxSicPct > 80 ? 'HIGH SEVERITY' : assessment.maxSicPct > 50 ? 'MODERATE' : 'NOMINAL'}
                  </span>
                </td>
              </tr>
              <tr>
                <td><strong>Iceberg Proximity</strong></td>
                <td>{assessment.minIcebergClearanceNmi ? `${assessment.minIcebergClearanceNmi.toFixed(1)} Nmi Minimum Clearance` : 'No icebergs detected near route'}</td>
                <td>
                   <span className={`badge ${!assessment.minIcebergClearanceNmi || assessment.minIcebergClearanceNmi > 15 ? 'badge-green' : assessment.minIcebergClearanceNmi > 5 ? 'badge-amber' : 'badge-red'}`}>
                     {!assessment.minIcebergClearanceNmi || assessment.minIcebergClearanceNmi > 15 ? 'SAFE MARGIN' : assessment.minIcebergClearanceNmi > 5 ? 'CAUTION' : 'DANGER'}
                   </span>
                </td>
              </tr>
              <tr>
                <td><strong>Prediction Confidence</strong></td>
                <td>{assessment.predictionConfidencePct}% AI Model Confidence</td>
                <td>
                   <span className={`badge ${assessment.predictionConfidencePct > 80 ? 'badge-green' : assessment.predictionConfidencePct > 60 ? 'badge-amber' : 'badge-red'}`}>
                     {assessment.predictionConfidencePct > 80 ? 'HIGH' : assessment.predictionConfidencePct > 60 ? 'MARGINAL' : 'LOW'}
                   </span>
                </td>
              </tr>
              <tr>
                <td><strong>Besetment Safety Index</strong></td>
                <td>{assessment.safetyScoreTotal} / 100</td>
                <td>
                   <span className={`badge ${assessment.safetyScoreTotal > 80 ? 'badge-green' : assessment.safetyScoreTotal > 50 ? 'badge-amber' : 'badge-red'}`}>
                     {assessment.safetyScoreTotal > 80 ? 'ACCEPTABLE' : assessment.safetyScoreTotal > 50 ? 'CAUTION' : 'CRITICAL'}
                   </span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Active Warnings Log */}
          <div
            style={{
              marginTop: '20px',
              padding: '16px',
              background: 'rgba(5, 11, 20, 0.7)',
              border: '1px solid var(--border-glass)',
              borderRadius: '10px',
              fontSize: '0.85rem',
              color: '#8b9bb4',
              lineHeight: '1.6'
            }}
          >
            <strong style={{ color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <InfoIcon size={16} /> Operational Briefing Log:
            </strong>
            <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {assessment.activeWarnings.map((warning, idx) => (
                <li key={idx} style={{ color: warning.includes('VIOLATION') || warning.includes('CRITICAL') || warning.includes('DANGER') ? '#ff4b5c' : warning.includes('ELEVATED') || warning.includes('WARNING') ? '#ffb703' : '#38ef7d' }}>
                  {warning}
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
};
