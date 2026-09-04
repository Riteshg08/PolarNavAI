import React from 'react';
import { Cpu, Database, CheckCircle2, RefreshCw, Layers, ShieldCheck } from 'lucide-react';
import { AIModelPipelineStatus } from '../types';

interface AIModelMetricsPanelProps {
  onClose: () => void;
}

export const AIModelMetricsPanel: React.FC<AIModelMetricsPanelProps> = ({ onClose }) => {
  const status: AIModelPipelineStatus = {
    uNetSeaIceSSIM: 0.948,
    uNetSeaIceRMSE: 3.2,
    pinnIcebergDriftRMSEKm24h: 1.85,
    sentinel1LastUpdated: '2026-09-03 12:45 UTC',
    amsr2LastUpdated: '2026-09-03 14:10 UTC',
    era5LastUpdated: '2026-09-03 06:00 UTC',
    hycomLastUpdated: '2026-09-03 00:00 UTC',
    activeModelVersion: 'v2.4-PolarRes-ConvLSTM'
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <Cpu size={20} color="#00f2fe" /> AI/ML Pipeline & Satellite Ingestion Telemetry
          </h2>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Model Performance Cards */}
          <div className="grid-3" style={{ marginBottom: '24px' }}>
            <div className="metric-box">
              <div className="metric-title">Sea Ice U-Net / ConvLSTM Accuracy</div>
              <div className="metric-num">{status.uNetSeaIceSSIM} SSIM</div>
              <div className="metric-sub">RMSE: {status.uNetSeaIceRMSE}% Concentration</div>
            </div>

            <div className="metric-box">
              <div className="metric-title">PINN Iceberg Drift Prediction Error</div>
              <div className="metric-num" style={{ color: '#38ef7d' }}>
                {status.pinnIcebergDriftRMSEKm24h} km / 24h
              </div>
              <div className="metric-sub">Hydrodynamic Forces ODE Solver</div>
            </div>

            <div className="metric-box">
              <div className="metric-title">Active AI Model Pipeline</div>
              <div className="metric-num" style={{ fontSize: '1.2rem', color: '#ffffff' }}>
                {status.activeModelVersion}
              </div>
              <div className="metric-sub" style={{ color: '#00f2fe' }}>
                Operational Status: Ready
              </div>
            </div>
          </div>

          {/* Satellite & Data Feeds Table */}
          <h4 style={{ color: '#00f2fe', marginBottom: '12px' }}>Operational Satellite & Data Ingestion Pipelines</h4>
          <table className="data-table">
            <thead>
              <tr>
                <th>Dataset / Source</th>
                <th>Sensor / Platform</th>
                <th>Resolution</th>
                <th>Target Feature</th>
                <th>Last Satellite Pass</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong style={{ color: '#ffffff' }}>Sentinel-1 C-Band SAR</strong>
                </td>
                <td>ESA Copernicus (EW Mode)</td>
                <td>40m Spatial</td>
                <td>Ice Floe Boundary & Iceberg Detection</td>
                <td>{status.sentinel1LastUpdated}</td>
                <td>
                  <span className="badge badge-green">LIVE FEED</span>
                </td>
              </tr>
              <tr>
                <td>
                  <strong style={{ color: '#ffffff' }}>AMSR2 Passive Microwave</strong>
                </td>
                <td>JAXA GCOM-W1</td>
                <td>6.25km Spatial</td>
                <td>Global Sea Ice Concentration (SIC)</td>
                <td>{status.amsr2LastUpdated}</td>
                <td>
                  <span className="badge badge-green">LIVE FEED</span>
                </td>
              </tr>
              <tr>
                <td>
                  <strong style={{ color: '#ffffff' }}>ERA5 Atmospheric Reanalysis</strong>
                </td>
                <td>ECMWF Data Store</td>
                <td>0.25° Mesh</td>
                <td>10m Surface Wind Vectors & Temp</td>
                <td>{status.era5LastUpdated}</td>
                <td>
                  <span className="badge badge-green">SYNCED</span>
                </td>
              </tr>
              <tr>
                <td>
                  <strong style={{ color: '#ffffff' }}>HYCOM / GLORYS Oceanography</strong>
                </td>
                <td>NRL / Mercator Ocean</td>
                <td>1/12° Hydrodynamic</td>
                <td>Surface & Deep Keel Ocean Current Vectors</td>
                <td>{status.hycomLastUpdated}</td>
                <td>
                  <span className="badge badge-green">SYNCED</span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Architecture Diagram Info */}
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
            <strong style={{ color: '#ffffff' }}>Multi-Modal AI Pipeline Architecture:</strong> Satellite radar backscatter (SAR) is merged with passive microwave imagery to form a temporal sequence tensor. The ConvLSTM network forecasts 7-day sea-ice concentration grids while a Physics-Informed Neural Network (PINN) solves the differential force balance equations for monster icebergs, ensuring high-fidelity guidance for NCPOR research missions.
          </div>
        </div>
      </div>
    </div>
  );
};
