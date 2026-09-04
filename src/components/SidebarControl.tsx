import React, { useState, useEffect, useRef } from 'react';
import { SeaIceForecastParams, StationLocation, VesselProfile } from '../types';
import { STATIONS } from '../data/stations';
import { VESSELS } from '../data/vessels';
import { Navigation, Ship, Sliders, Calendar, Eye, Compass, Anchor, Activity, ChevronDown, ChevronRight, Loader2, Shield, Wind, Droplets, Play, Pause } from 'lucide-react';
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
  totalVoyageDays: number;
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
  onRunOptimization,
  totalVoyageDays
}) => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    expedition: true,
    vessel: true,
    forecast: true,
    metrics: true
  });

  // Autoplay: cycle forecast days 0→totalVoyageDays, then stop
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    if (isAutoPlaying) {
      autoPlayRef.current = setInterval(() => {
        const current = paramsRef.current;
        const maxDay = Math.max(7, totalVoyageDays);
        if (current.forecastDay >= maxDay) {
          // Voyage complete — stop autoplay
          setIsAutoPlaying(false);
          return;
        }
        const nextDay = current.forecastDay + 1;
        onChangeParams({ ...current, forecastDay: nextDay });
      }, 1500);
    } else {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    }
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [isAutoPlaying, totalVoyageDays]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const selectedVessel = VESSELS.find((v) => v.id === params.selectedVesselId) || VESSELS[0];
  const origin = STATIONS.find((s) => s.id === params.originStationId) || STATIONS[0];
  const dest = STATIONS.find((s) => s.id === params.destinationStationId) || STATIONS[1];

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

  const handleRunOptimization = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      onRunOptimization();
      setIsOptimizing(false);
    }, 800); // Simulate network/computation delay
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-scroll">
        
        {/* Expedition Station Presets */}
        <div className="panel-card">
          <div className="panel-title" onClick={() => toggleSection('expedition')}>
            <Anchor size={16} /> Expedition Route Planner
            {expandedSections.expedition ? <ChevronDown size={16} className="icon-right" /> : <ChevronRight size={16} className="icon-right" />}
          </div>

          {expandedSections.expedition && (
            <>
              <div className="form-group">
                <label className="form-label">Origin Port / Anchorage</label>
                <select
                  className="select-input"
                  title={origin.name}
                  value={params.originStationId}
                  onChange={(e) => onChangeParams({ ...params, originStationId: e.target.value })}
                >
                  {STATIONS.map((s) => (
                    <option key={s.id} value={s.id} title={`${s.name} (${s.country})`}>
                      {s.name} ({s.country})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Destination Station</label>
                <select
                  className="select-input"
                  title={dest.name}
                  value={params.destinationStationId}
                  onChange={(e) => onChangeParams({ ...params, destinationStationId: e.target.value })}
                >
                  {STATIONS.map((s) => (
                    <option key={s.id} value={s.id} title={`${s.name} (${s.country})`}>
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
                  title="Cape Town → Bharati"
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
                  title="Cape Town → Maitri"
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
                  title="Prydz Bay → Bharati"
                  onClick={() => handleSelectPreset('PRYDZ_BAY', 'BHARATI')}
                >
                  Prydz Bay → Bharati
                </button>
              </div>
            </>
          )}
        </div>

        {/* Vessel Specifications & Polar Class */}
        <div className="panel-card">
          <div className="panel-title" onClick={() => toggleSection('vessel')}>
            <Ship size={16} /> Research Vessel Profile
            {expandedSections.vessel ? <ChevronDown size={16} className="icon-right" /> : <ChevronRight size={16} className="icon-right" />}
          </div>

          {expandedSections.vessel && (
            <>
              <div className="form-group">
                <label className="form-label">Select Vessel</label>
                <select
                  className="select-input"
                  title={selectedVessel.name}
                  value={params.selectedVesselId}
                  onChange={(e) => onChangeParams({ ...params, selectedVesselId: e.target.value })}
                >
                  {VESSELS.map((v) => (
                    <option key={v.id} value={v.id} title={`${v.name} [${v.polarClass}]`}>
                      {v.name} [{v.polarClass}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="info-panel">
                <div className="info-row">
                  <span className="info-label"><Shield size={14} /> Polar Class Rating</span>
                  <span className="badge badge-cyan">{selectedVessel.polarClass}</span>
                </div>
                <div className="info-row">
                  <span className="info-label"><Wind size={14} /> Ice Breaking Cap.</span>
                  <span className="info-value">{selectedVessel.iceBreakingCapacityMeters}m level ice</span>
                </div>
                <div className="info-row">
                  <span className="info-label"><Droplets size={14} /> Base Fuel Burn</span>
                  <span className="info-value green">{selectedVessel.baseFuelBurnTonsPerDay} tons/day</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Forecast Timeline Slider */}
        <div className="panel-card">
          <div className="panel-title" onClick={() => toggleSection('forecast')}>
            <Calendar size={16} /> AI Forecast Horizon (ConvLSTM)
            {expandedSections.forecast ? <ChevronDown size={16} className="icon-right" /> : <ChevronRight size={16} className="icon-right" />}
          </div>

          {expandedSections.forecast && (
            <>
              <div className="slider-container">
                <input
                  type="range"
                  min={0}
                  max={Math.max(7, totalVoyageDays)}
                  step={1}
                  value={params.forecastDay}
                  className="range-slider"
                  onChange={(e) =>
                    onChangeParams({ ...params, forecastDay: parseInt(e.target.value) })
                  }
                />
                <span className="slider-val">
                  {params.forecastDay === 0 ? 'Now' : `Day ${params.forecastDay}/${Math.max(7, totalVoyageDays)}`}
                </span>
              </div>
              <div className="slider-container" style={{ marginTop: '-4px' }}>
                <div className="slider-ticks" style={{ flex: 1, width: 'auto', marginTop: 0 }}>
                  {Array.from({ length: Math.min(Math.max(7, totalVoyageDays) + 1, 22) }, (_, i) => {
                    const maxDay = Math.max(7, totalVoyageDays);
                    // Show fewer tick labels for long voyages
                    if (maxDay > 14 && i % 3 !== 0 && i !== maxDay) return <span key={i}></span>;
                    if (maxDay > 7 && maxDay <= 14 && i % 2 !== 0 && i !== maxDay) return <span key={i}></span>;
                    return <span key={i}>{i}</span>;
                  })}
                </div>
                <span className="slider-val" style={{ visibility: 'hidden' }}>
                  {params.forecastDay === 0 ? 'Now' : `+${params.forecastDay}d`}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                <button
                  className="autoplay-btn"
                  onClick={() => {
                    if (params.forecastDay >= Math.max(7, totalVoyageDays)) {
                      // Reset to day 0 and start again
                      onChangeParams({ ...params, forecastDay: 0 });
                    }
                    setIsAutoPlaying(prev => !prev);
                  }}
                  title={isAutoPlaying ? 'Pause simulation' : 'Simulate voyage'}
                >
                  {isAutoPlaying ? <Pause size={14} /> : <Play size={14} />}
                  <span>{isAutoPlaying ? 'Pause' : params.forecastDay >= Math.max(7, totalVoyageDays) ? 'Restart' : 'Simulate Voyage'}</span>
                </button>
                <span style={{ fontSize: '0.72rem', color: '#8b9bb4' }}>
                  {params.forecastDay >= Math.max(7, totalVoyageDays) 
                    ? '✓ Voyage Complete' 
                    : isAutoPlaying 
                      ? `Simulating Day ${params.forecastDay}/${Math.max(7, totalVoyageDays)}...` 
                      : `Day ${params.forecastDay} of ${Math.max(7, totalVoyageDays)}`
                  }
                </span>
              </div>
            </>
          )}
        </div>

        {/* AI Forecast Metrics */}
        <div className="panel-card">
          <div className="panel-title" onClick={() => toggleSection('metrics')}>
            <Activity size={16} /> SIC Forecast Metrics
            {expandedSections.metrics ? <ChevronDown size={16} className="icon-right" /> : <ChevronRight size={16} className="icon-right" />}
          </div>
          
          {expandedSections.metrics && (
            <div className="info-panel">
              <div className="info-row">
                <span className="info-label">Origin ({origin.name.split(' ')[0]})</span>
                <span className="badge badge-cyan">{originSic.toFixed(1)}%</span>
              </div>
              <div className="info-row">
                <span className="info-label">Destination ({dest.name.split(' ')[0]})</span>
                <span className="badge badge-amber">{destSic.toFixed(1)}%</span>
              </div>
              <div className="info-row">
                <span className="info-label">Dest. Change (Day 0)</span>
                <span className={`info-value ${destChange > 0 ? 'red' : 'green'}`}>
                  {destChange > 0 ? '+' : ''}{destChange.toFixed(1)}%
                </span>
              </div>
              <div className="info-row divider">
                <span className="info-label">Forecast Confidence</span>
                <span className="info-value">{forecastGrid.confidencePct}%</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </aside>
  );
};

