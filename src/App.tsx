import React, { useState, useMemo } from 'react';
import { SeaIceForecastParams, RouteOption, Iceberg } from './types';
import { solvePolarRoutes } from './utils/polarPhysics';
import { VESSELS } from './data/vessels';
import { STATIONS } from './data/stations';
import { ICEBERGS } from './data/icebergs';
import { HeaderNav } from './components/HeaderNav';
import { SidebarControl } from './components/SidebarControl';
import { PolarMapCanvas } from './components/PolarMapCanvas';
import { IcebergTrackerPanel } from './components/IcebergTrackerPanel';
import { RouteAnalyticsModal } from './components/RouteAnalyticsModal';
import { AIModelMetricsPanel } from './components/AIModelMetricsPanel';
import { MissionAssessmentPanel } from './components/MissionAssessmentPanel';
import { ShieldCheck, Fuel, Clock, Compass, Anchor, Leaf } from 'lucide-react';
import { generateMissionAssessment } from './explain/missionAssessment';

import { predictTrajectory } from './models/icebergDrift';

export const App: React.FC = () => {
  // Compute dynamic iceberg trajectories
  const dynamicIcebergs = useMemo(() => {
    return ICEBERGS.map(ib => ({
      ...ib,
      predictedTrajectory: predictTrajectory(ib, 7)
    }));
  }, []);

  // Navigation & Forecast Parameters
  const [params, setParams] = useState<SeaIceForecastParams>({
    forecastDay: 0,
    iceConcentrationThreshold: 85,
    optimizationWeight: 'BALANCED',
    selectedVesselId: 'VESSEL_BHARATI',
    originStationId: 'CAPE_TOWN',
    destinationStationId: 'BHARATI'
  });

  // Calculate Routes based on current params
  const routes: RouteOption[] = useMemo(() => {
    return solvePolarRoutes(params, dynamicIcebergs);
  }, [params, dynamicIcebergs]);

  // Selected Route Strategy
  const [activeRouteId, setActiveRouteId] = useState<'OPTIMAL_AI' | 'SHORTEST_DISTANCE' | 'CONVENTIONAL'>('OPTIMAL_AI');

  // Selected Iceberg Focus
  const [selectedIceberg, setSelectedIceberg] = useState<Iceberg | null>(null);

  // Layer Visibility
  const [showIcebergs, setShowIcebergs] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [showVectors, setShowVectors] = useState<boolean>(true);

  // Modals Visibility
  const [showIcebergsModal, setShowIcebergsModal] = useState<boolean>(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState<boolean>(false);
  const [showAIModelModal, setShowAIModelModal] = useState<boolean>(false);
  const [showMissionModal, setShowMissionModal] = useState<boolean>(false);

  const activeRoute = routes.find((r) => r.id === activeRouteId) || routes[0];
  const activeVessel = VESSELS.find((v) => v.id === params.selectedVesselId) || VESSELS[0];
  const originStation = STATIONS.find((s) => s.id === params.originStationId) || STATIONS[0];
  const destStation = STATIONS.find((s) => s.id === params.destinationStationId) || STATIONS[1];

  const missionAssessment = useMemo(() => {
    return generateMissionAssessment(
      activeRoute,
      activeVessel,
      originStation,
      destStation,
      params,
      activeRoute.safetyScore,
      activeRoute.clearanceResult!,
      activeRoute.feasibilityResult!
    );
  }, [activeRoute, activeVessel, originStation, destStation, params]);

  const handleRunOptimization = () => {
    // Refresh routes computation
    setParams({ ...params });
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <HeaderNav
        onOpenIcebergs={() => setShowIcebergsModal(true)}
        onOpenAnalytics={() => setShowAnalyticsModal(true)}
        onOpenAIModel={() => setShowAIModelModal(true)}
        onOpenMission={() => setShowMissionModal(true)}
        activeRouteTitle={activeRoute.title}
      />

      {/* Main Content (Sidebar + Map Canvas) */}
      <div className="main-content">
        <SidebarControl
          params={params}
          onChangeParams={setParams}
          showIcebergs={showIcebergs}
          onToggleIcebergs={() => setShowIcebergs(!showIcebergs)}
          showHeatmap={showHeatmap}
          onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
          showVectors={showVectors}
          onToggleVectors={() => setShowVectors(!showVectors)}
          onRunOptimization={handleRunOptimization}
        />

        <PolarMapCanvas
          routes={routes}
          icebergs={dynamicIcebergs}
          activeRouteId={activeRouteId}
          selectedIceberg={selectedIceberg}
          onSelectIceberg={setSelectedIceberg}
          forecastDay={params.forecastDay}
          showIcebergs={showIcebergs}
          showHeatmap={showHeatmap}
          showVectors={showVectors}
        />
      </div>

      {/* Telemetry Footer Bar */}
      <footer className="telemetry-bar">
        <div className="telemetry-group">
          <div className="telemetry-item">
            <span className="telemetry-label">Active Expedition Track</span>
            <div className="telemetry-val cyan">
              <Anchor size={14} />
              {originStation.name.split(' ')[0]} → {destStation.name.split(' ')[0]}
            </div>
          </div>

          <div className="telemetry-item">
            <span className="telemetry-label">Vessel & Ice Class</span>
            <div className="telemetry-val">
              {activeVessel.name} [{activeVessel.polarClass}]
            </div>
          </div>

          <div className="telemetry-item">
            <span className="telemetry-label">Total Distance</span>
            <div className="telemetry-val">{activeRoute.totalDistanceNmi} Nmi</div>
          </div>

          <div className="telemetry-item">
            <span className="telemetry-label">Est. Voyage Time</span>
            <div className="telemetry-val">
              <Clock size={14} />
              {activeRoute.totalTimeHours} hrs ({(activeRoute.totalTimeHours / 24).toFixed(1)} days)
            </div>
          </div>
        </div>

        <div className="telemetry-group">
          <div className="telemetry-item">
            <span className="telemetry-label">Est. Fuel Burn</span>
            <div className="telemetry-val green">
              <Fuel size={14} />
              {activeRoute.fuelConsumedTons} Tons MGO
            </div>
          </div>

          <div className="telemetry-item">
            <span className="telemetry-label">CO2 Reduction</span>
            <div className="telemetry-val green">
              <Leaf size={14} />
              {activeRoute.co2SavedTons} Tons CO2 Saved
            </div>
          </div>

          <div className="telemetry-item">
            <span className="telemetry-label">Besetment Safety Index</span>
            <div className="telemetry-val cyan">
              <ShieldCheck size={16} />
              {activeRoute.safetyScore.total} / 100
            </div>
            <div style={{ fontSize: '0.65rem', color: '#8b9bb4', marginTop: '4px' }}>
              Ice: {activeRoute.safetyScore.seaIceRisk} | Berg: {activeRoute.safetyScore.icebergRisk} | Wx: {activeRoute.safetyScore.weatherRisk} | Ship: {activeRoute.safetyScore.vesselRisk}
            </div>
          </div>

          <div className="telemetry-item">
            <span className="telemetry-label">Forecast Confidence</span>
            <div className="telemetry-val" style={{ color: activeRoute.safetyScore.overallConfidencePct > 80 ? '#38ef7d' : '#ffb703' }}>
              {activeRoute.safetyScore.overallConfidencePct}%
            </div>
            <div style={{ fontSize: '0.65rem', color: '#8b9bb4', marginTop: '4px', fontStyle: 'italic' }}>
              Based on temporal trajectory uncertainty
            </div>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {showIcebergsModal && (
        <IcebergTrackerPanel
          icebergs={dynamicIcebergs}
          selectedIceberg={selectedIceberg}
          onSelectIceberg={setSelectedIceberg}
          onClose={() => setShowIcebergsModal(false)}
        />
      )}

      {showAnalyticsModal && (
        <RouteAnalyticsModal
          routes={routes}
          activeRouteId={activeRouteId}
          onSelectRoute={setActiveRouteId}
          onClose={() => setShowAnalyticsModal(false)}
        />
      )}

      {showAIModelModal && (
        <AIModelMetricsPanel onClose={() => setShowAIModelModal(false)} />
      )}

      {showMissionModal && (
        <MissionAssessmentPanel 
          assessment={missionAssessment} 
          onClose={() => setShowMissionModal(false)} 
        />
      )}
    </div>
  );
};
