import React from 'react';
import { SeaIceForecastParams, StationLocation, VesselProfile } from '../types';
import { STATIONS } from '../data/stations';
import { VESSELS } from '../data/vessels';
import { Navigation, Ship, Sliders, Calendar, Eye, Compass, Anchor, Activity } from 'lucide-react';
import { getForecastGrid, getSicAt } from '../models/seaIceForecast';
import { fetchSentinel1IceObservations } from '../data/adapters/sentinel1Adapter';
import { fetchAMSR2IceGrid } from '../data/adapters/amsr2Adapter';
import { fetchERA5WindGrid } from '../data/adapters/era5Adapter';
import { fetchHycomOceanGrid } from '../data/adapters/hycomAdapter';

interface SidebarControlProps {
  params: SeaIceForecastParams;
  onChangeParams: (newParams: SeaIceForecastParams) => void;
  showIcebergs: boolean;
  onToggleIcebergs: () => void;
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  showVectors: boolean;
  onToggleVectors: () => void;
  onRunOptimization: () => void;
}

export const SidebarControl: React.FC<SidebarControlProps> = ({
  params,
  onChangeParams,
  showIcebergs,
  onToggleIcebergs,
  showHeatmap,
  onToggleHeatmap,
  showVectors,
  onToggleVectors,
  onRunOptimization
}) => {
  const selectedVessel = VESSELS.find((v) => v.id === params.selectedVesselId) || VESSELS[0];
  const origin = STATIONS.find((s) => s.id === params.originStationId) || STATIONS[0];
  const dest = STATIONS.find((s) => s.id === params.destinationStationId) || STATIONS[1];

  const sentinel1Meta = fetchSentinel1IceObservations(0, 0, 0).metadata;
  const amsr2Meta = fetchAMSR2IceGrid(0, 0, 0).metadata;
  const era5Meta = fetchERA5WindGrid(0, 0, 0).metadata;
  const hycomMeta = fetchHycomOceanGrid(0, 0, 0).metadata;

  const forecastGrid = getForecastGrid(params.forecastDay);
  const originSic = getSicAt(origin.lat, origin.lon, params.forecastDay);
  const destSic = getSicAt(dest.lat, dest.lon, params.forecastDay);
  const destSicDay0 = getSicAt(dest.lat, dest.lon, 0);
  const destChange = destSic - destSicDay0;

  const handleSelectPreset = (origId: string, destId: string) => {
    onChangeParams({
      ...params,
      originStationId: origId,
      destinationStationId: destId
    });
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-scroll">
        
        {/* Expedition Station Presets */}
        <div className="panel-card">
          <div className="panel-title">
            <Anchor size={16} /> Expedition Route Planner
          </div>

          <div className="form-group">
            <label className="form-label">Origin Port / Anchorage</label>
            <select
              className="select-input"
              value={params.originStationId}
              onChange={(e) => onChangeParams({ ...params, originStationId: e.target.value })}
            >
              {STATIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.country})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Destination Station</label>
            <select
              className="select-input"
              value={params.destinationStationId}
              onChange={(e) => onChangeParams({ ...params, destinationStationId: e.target.value })}
            >
              {STATIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.country})
                </option>
              ))}
            </select>
          </div>

          <div className="preset-pills">
            <button
              className={`btn-preset ${
                params.originStationId === 'CAPE_TOWN' && params.destinationStationId === 'BHARATI'
                  ? 'active'
                  : ''
              }`}
              onClick={() => handleSelectPreset('CAPE_TOWN', 'BHARATI')}
            >
              Cape Town → Bharati
            </button>
            <button
              className={`btn-preset ${
                params.originStationId === 'CAPE_TOWN' && params.destinationStationId === 'MAITRI'
                  ? 'active'
                  : ''
              }`}
              onClick={() => handleSelectPreset('CAPE_TOWN', 'MAITRI')}
            >
              Cape Town → Maitri
            </button>
            <button
              className={`btn-preset ${
                params.originStationId === 'PRYDZ_BAY' && params.destinationStationId === 'BHARATI'
                  ? 'active'
                  : ''
              }`}
              onClick={() => handleSelectPreset('PRYDZ_BAY', 'BHARATI')}
            >
              Prydz Bay → Bharati
            </button>
          </div>
        </div>

        {/* Vessel Specifications & Polar Class */}
        <div className="panel-card">
          <div className="panel-title">
            <Ship size={16} /> Research Vessel Profile
          </div>

          <div className="form-group">
            <label className="form-label">Select Vessel</label>
            <select
              className="select-input"
              value={params.selectedVesselId}
              onChange={(e) => onChangeParams({ ...params, selectedVesselId: e.target.value })}
            >
              {VESSELS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} [{v.polarClass}]
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              background: 'rgba(5, 11, 20, 0.6)',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(0, 242, 254, 0.1)',
              fontSize: '0.78rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#8b9bb4' }}>Polar Class Rating</span>
              <span className="badge badge-cyan">{selectedVessel.polarClass}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#8b9bb4' }}>Ice Breaking Cap.</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: '#ffffff' }}>
                {selectedVessel.iceBreakingCapacityMeters}m level ice
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#8b9bb4' }}>Base Fuel Burn</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: '#38ef7d' }}>
                {selectedVessel.baseFuelBurnTonsPerDay} tons/day
              </span>
            </div>
          </div>
        </div>

        {/* Forecast Timeline Slider */}
        <div className="panel-card">
          <div className="panel-title">
            <Calendar size={16} /> AI Forecast Horizon (ConvLSTM)
          </div>

          <div className="slider-container">
            <input
              type="range"
              min={0}
              max={7}
              step={1}
              value={params.forecastDay}
              className="range-slider"
              onChange={(e) =>
                onChangeParams({ ...params, forecastDay: parseInt(e.target.value) })
              }
            />
            <span className="slider-val">
              {params.forecastDay === 0 ? 'Now' : `+${params.forecastDay} Days`}
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#8b9bb4', marginTop: '6px' }}>
            Simulating ice drift and satellite updates for Day +{params.forecastDay}.
          </div>
        </div>

        {/* AI Forecast Metrics */}
        <div className="panel-card">
          <div className="panel-title">
            <Activity size={16} /> SIC Forecast Metrics
          </div>
          <div
            style={{
              background: 'rgba(5, 11, 20, 0.6)',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(0, 242, 254, 0.1)',
              fontSize: '0.78rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#8b9bb4' }}>Origin ({origin.name.split(' ')[0]})</span>
              <span className="badge badge-cyan">{originSic.toFixed(1)}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#8b9bb4' }}>Destination ({dest.name.split(' ')[0]})</span>
              <span className="badge badge-amber">{destSic.toFixed(1)}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#8b9bb4' }}>Dest. Change (Day 0)</span>
              <span style={{ color: destChange > 0 ? '#ff4b5c' : '#38ef7d', fontFamily: 'var(--font-mono)' }}>
                {destChange > 0 ? '+' : ''}{destChange.toFixed(1)}%
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
              <span style={{ color: '#8b9bb4' }}>Forecast Confidence</span>
              <span style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                {forecastGrid.confidencePct}%
              </span>
            </div>
          </div>
        </div>

        {/* GIS Map Layer Toggles */}
        <div className="panel-card">
          <div className="panel-title">
            <Eye size={16} /> GIS Map Layers
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={showHeatmap} onChange={onToggleHeatmap} />
              <span>Sea Ice Concentration Heatmap (AMSR2)</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={showIcebergs} onChange={onToggleIcebergs} />
              <span>Monster Iceberg Markers (Sentinel-1 SAR)</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={showVectors} onChange={onToggleVectors} />
              <span>Iceberg 7-Day Drift Trajectory Vectors</span>
            </label>
          </div>
        </div>

        {/* Run Optimization Button */}
        <button className="btn-action-primary" onClick={onRunOptimization}>
          <Navigation size={18} /> Re-Calculate AI Polar Route
        </button>

      </div>
    </aside>
  );
};
