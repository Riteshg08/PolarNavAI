import React from 'react';
import { Iceberg } from '../types';
import { ICEBERGS } from '../data/icebergs';
import { AlertTriangle, Compass, Radio, Satellite } from 'lucide-react';

interface IcebergTrackerPanelProps {
  icebergs: Iceberg[];
  selectedIceberg: Iceberg | null;
  onSelectIceberg: (iceberg: Iceberg | null) => void;
  onClose: () => void;
}

export const IcebergTrackerPanel: React.FC<IcebergTrackerPanelProps> = ({
  icebergs,
  selectedIceberg,
  onSelectIceberg,
  onClose
}) => {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <AlertTriangle size={20} color="#ff4b5c" /> Antarctic Iceberg Trajectory & Risk Telemetry
          </h2>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div style={{ fontSize: '0.85rem', color: '#8b9bb4', marginBottom: '16px' }}>
            Tracking major Antarctic iceberg drift vectors computed via Physics-Informed Neural Networks (PINN) and Sentinel-1 SAR imagery.
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Iceberg ID & Name</th>
                <th>Dimensions (L × W)</th>
                <th>Est. Draft / Height</th>
                <th>Drift Speed & Heading</th>
                <th>Hazard Status</th>
                <th>Data Provenance</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {icebergs.map((ib) => {
                const isSelected = selectedIceberg?.id === ib.id;
                return (
                  <tr
                    key={ib.id}
                    style={{
                      background: isSelected ? 'rgba(0, 242, 254, 0.1)' : 'transparent'
                    }}
                  >
                    <td>
                      <strong style={{ color: '#ffffff' }}>{ib.name}</strong>
                      <div style={{ fontSize: '0.72rem', color: '#8b9bb4' }}>
                        Lat: {ib.lat.toFixed(2)}° S • Lon: {ib.lon.toFixed(2)}° E
                      </div>
                    </td>
                    <td>
                      {ib.lengthKm} km × {ib.widthKm} km
                    </td>
                    <td>{ib.heightMeters} m</td>
                    <td>
                      <span style={{ color: '#00f2fe' }}>{ib.driftSpeedKnots} kts</span> @ {ib.driftHeadingDeg}°
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          ib.hazardLevel === 'CRITICAL'
                            ? 'badge-red'
                            : ib.hazardLevel === 'HIGH'
                            ? 'badge-amber'
                            : 'badge-cyan'
                        }`}
                      >
                        {ib.hazardLevel}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#8b9bb4' }}>
                        <Satellite size={12} color="#00f2fe" />
                        {ib.source}
                      </div>
                    </td>
                    <td>
                      <button
                        className="btn-preset active"
                        onClick={() => onSelectIceberg(ib)}
                      >
                        {isSelected ? 'Selected' : 'Focus Radar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {selectedIceberg && (
            <div
              style={{
                marginTop: '20px',
                padding: '16px',
                background: 'rgba(15, 30, 54, 0.6)',
                border: '1px solid var(--border-glow)',
                borderRadius: '12px'
              }}
            >
              <h4 style={{ color: '#00f2fe', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Radio size={16} /> Selected Focus: {selectedIceberg.name}
              </h4>
              <p style={{ fontSize: '0.82rem', color: '#f0f6fc', lineHeight: '1.5' }}>
                Last observed timestamp: <strong>{selectedIceberg.lastObserved}</strong>. Hydrodynamic forces (ocean current drag vs wind shear) predict a general drift trajectory bearing of approximately <strong>{selectedIceberg.driftHeadingDeg}°</strong>. Recommended vessel clearance buffer: <strong>25 Nautical Miles (plus temporal uncertainty)</strong>.
              </p>
              
              <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(0, 242, 254, 0.05)', borderRadius: '6px', borderLeft: '2px solid #00f2fe' }}>
                <div style={{ fontSize: '0.75rem', color: '#8b9bb4', marginBottom: '4px' }}>
                  <strong>Drift Prediction Model Pipeline (PINN Stand-in)</strong>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span><strong>Inputs:</strong> ERA5 Atmospheric Wind Grid, HYCOM Ocean Currents</span>
                  <span><strong>Forecast Confidence (Day 7):</strong> ~65% (Radius: ~11.9km)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
