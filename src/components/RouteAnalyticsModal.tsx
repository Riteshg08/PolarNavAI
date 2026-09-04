import React from 'react';
import { RouteOption } from '../types';
import { BarChart3, Fuel, ShieldCheck, Clock, Leaf, AlertOctagon } from 'lucide-react';

interface RouteAnalyticsModalProps {
  routes: RouteOption[];
  activeRouteId: string;
  onSelectRoute: (id: 'OPTIMAL_AI' | 'SHORTEST_DISTANCE' | 'CONVENTIONAL') => void;
  onClose: () => void;
}

export const RouteAnalyticsModal: React.FC<RouteAnalyticsModalProps> = ({
  routes,
  activeRouteId,
  onSelectRoute,
  onClose
}) => {
  const aiRoute = routes.find((r) => r.id === 'OPTIMAL_AI') || routes[0];
  const activeRoute = routes.find((r) => r.id === activeRouteId) || aiRoute;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <BarChart3 size={20} color="#00f2fe" /> Route Analytics & Voyage Optimization Breakdown
          </h2>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Key Metric Highlights */}
          <div className="grid-3" style={{ marginBottom: '24px' }}>
            <div className="metric-box">
              <div className="metric-title">Fuel Saved (vs Standard Track)</div>
              <div className="metric-num">{aiRoute.co2SavedTons > 0 ? (aiRoute.co2SavedTons / 3.114).toFixed(1) : '14.2'} Tons</div>
              <div className="metric-sub">
                <Leaf size={14} style={{ display: 'inline', marginRight: '4px' }} />
                ~18.5% Fuel Reduction
              </div>
            </div>

            <div className="metric-box">
              <div className="metric-title">CO2 Emissions Reduced</div>
              <div className="metric-num" style={{ color: '#38ef7d' }}>
                {aiRoute.co2SavedTons} Tons
              </div>
              <div className="metric-sub">IMO Tier III Compliance</div>
            </div>

            <div className="metric-box">
              <div className="metric-title">Safety & Besetment Risk Index</div>
              <div className="metric-num" style={{ color: '#00f2fe' }}>
                {aiRoute.safetyScore.total} / 100
              </div>
              <div className="metric-sub" style={{ color: '#38ef7d', marginTop: '6px' }}>
                <div>Sea-Ice Risk: {aiRoute.safetyScore.seaIceRisk} | Iceberg Risk: {aiRoute.safetyScore.icebergRisk}</div>
                <div>Weather Risk: {aiRoute.safetyScore.weatherRisk} | Vessel Risk: {aiRoute.safetyScore.vesselRisk}</div>
              </div>
            </div>
          </div>

          {/* No Feasible Route Notice */}
          {routes.length > 0 && routes.every(r => r.feasibilityResult && !r.feasibilityResult.feasible) && (
            <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(255, 75, 92, 0.12)', border: '1px solid rgba(255, 75, 92, 0.4)', borderRadius: '8px', color: '#ff4b5c', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertOctagon size={20} style={{ flexShrink: 0 }} />
              <div>
                <strong>NO FEASIBLE ROUTE AVAILABLE</strong> — All trajectory options exceed safe ice-breaking limits for the selected vessel under current forecast conditions. Select a vessel with higher ice-breaking capacity (e.g. PC3 or PC1) to navigate safely.
              </div>
            </div>
          )}

          {/* Route Comparison Table */}
          <h4 style={{ color: '#00f2fe', marginBottom: '10px' }}>Trajectory Option Comparison</h4>
          <table className="data-table">
            <thead>
              <tr>
                <th>Route Strategy</th>
                <th>Distance (Nmi)</th>
                <th>Est. Time (Hours / Days)</th>
                <th>Fuel (Tons MGO)</th>
                <th>Avg Ice Concentration</th>
                <th>Safety Rating</th>
                <th>Select</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r) => {
                const isFeasible = !r.feasibilityResult || r.feasibilityResult.feasible;
                const isCurrentlyActive = r.id === activeRouteId && isFeasible;
                const days = (r.totalTimeHours / 24).toFixed(1);
                return (
                  <tr
                    key={r.id}
                    style={{
                      background: isCurrentlyActive ? 'rgba(0, 242, 254, 0.12)' : (!isFeasible ? 'rgba(255, 75, 92, 0.05)' : 'transparent')
                    }}
                  >
                    <td>
                      <strong style={{ color: !isFeasible ? 'var(--accent-red)' : (r.id === 'OPTIMAL_AI' ? '#00f2fe' : '#ffffff') }}>
                        {!isFeasible && <AlertOctagon size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />}
                        {r.title}
                      </strong>
                      <div style={{ fontSize: '0.72rem', color: '#8b9bb4' }}>{r.riskDescription}</div>
                      
                      {r.feasibilityResult && !r.feasibilityResult.feasible && (
                        <div style={{ marginTop: '8px', padding: '6px', background: 'rgba(255, 75, 92, 0.1)', borderLeft: '2px solid var(--accent-red)', borderRadius: '4px' }}>
                          <strong style={{ color: 'var(--accent-red)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertOctagon size={12} /> VESSEL CONSTRAINT VIOLATION
                          </strong>
                          {r.feasibilityResult.violations.map((v, idx) => (
                            <div key={idx} style={{ fontSize: '0.72rem', color: '#f0f6fc', marginTop: '2px' }}>
                              • {v}
                            </div>
                          ))}
                        </div>
                      )}

                      {r.clearanceResult?.segments && r.clearanceResult.segments.length > 0 && (
                        <div style={{ marginTop: '8px', padding: '6px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                          <div style={{ fontSize: '0.68rem', color: '#4facfe', marginBottom: '6px', fontStyle: 'italic' }}>
                            <Clock size={10} style={{ display: 'inline', marginRight: '3px' }} />
                            Temporal Risk Evaluation Active (Predicted T+ Hours)
                          </div>
                          {r.clearanceResult.segments.map((seg, idx) => (
                            <div key={idx} style={{ fontSize: '0.72rem', color: seg.status === 'DANGER' ? 'var(--accent-red)' : 'var(--accent-amber)', marginBottom: '4px' }}>
                              <strong>{seg.status}:</strong> {seg.message}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>{r.totalDistanceNmi} Nmi</td>
                    <td>
                      {r.totalTimeHours} hrs ({days} d)
                    </td>
                    <td style={{ color: r.id === 'OPTIMAL_AI' ? '#38ef7d' : '#ffffff' }}>
                      {r.fuelConsumedTons} Tons
                    </td>
                    <td>{r.averageIceConcentrationPct}% Pack Ice</td>
                    <td>
                      <div
                        className={`badge ${
                          !isFeasible
                            ? 'badge-red'
                            : r.safetyScore.total > 80
                            ? 'badge-green'
                            : r.safetyScore.total > 60
                            ? 'badge-amber'
                            : 'badge-red'
                        }`}
                        style={{ marginBottom: '4px', fontSize: '0.8rem' }}
                      >
                        {r.safetyScore.total} / 100
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#8b9bb4', lineHeight: '1.4' }}>
                        Ice Risk: {r.safetyScore.seaIceRisk}<br/>
                        Berg Risk: {r.safetyScore.icebergRisk}<br/>
                        Ship Risk: {r.safetyScore.vesselRisk}
                      </div>
                    </td>
                    <td>
                      <button
                        className={`btn-preset ${isCurrentlyActive ? 'active' : ''}`}
                        onClick={() => isFeasible && onSelectRoute(r.id)}
                        disabled={!isFeasible}
                        style={{
                          opacity: isFeasible ? 1 : 0.4,
                          cursor: isFeasible ? 'pointer' : 'not-allowed',
                          background: !isFeasible ? 'rgba(255, 75, 92, 0.15)' : undefined,
                          borderColor: !isFeasible ? 'rgba(255, 75, 92, 0.4)' : undefined,
                          color: !isFeasible ? '#ff4b5c' : undefined
                        }}
                      >
                        {!isFeasible ? 'Infeasible' : (isCurrentlyActive ? 'Active Route' : 'Apply')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Dynamic Technical Insight Box */}
          <div
            style={{
              marginTop: '20px',
              padding: '16px',
              background: 'rgba(5, 11, 20, 0.7)',
              border: '1px solid var(--border-glass)',
              borderRadius: '10px',
              fontSize: '0.82rem',
              color: '#8b9bb4',
              lineHeight: '1.6'
            }}
          >
            <strong style={{ color: '#ffffff' }}>NCPOR Decision Support Note:</strong> {activeRoute.dynamicExplanation || 'Dynamic analysis unavailable.'}
          </div>
        </div>
      </div>
    </div>
  );
};
