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
import { ShieldCheck, Fuel, Clock, Compass, Anchor, Leaf, Ship, Activity, AlertOctagon } from 'lucide-react';
import { generateMissionAssessment } from './explain/missionAssessment';

import { predictTrajectory, MAX_FORECAST_DAYS } from './models/icebergDrift';

export const App: React.FC = () => {
  // Compute dynamic iceberg trajectories
  const dynamicIcebergs = useMemo(() => {
    return ICEBERGS.map(ib => ({
      ...ib,
      predictedTrajectory: predictTrajectory(ib, MAX_FORECAST_DAYS)
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

  const activeVessel = VESSELS.find((v) => v.id === params.selectedVesselId) || VESSELS[0];
  const originStation = STATIONS.find((s) => s.id === params.originStationId) || STATIONS[0];
  const destStation = STATIONS.find((s) => s.id === params.destinationStationId) || STATIONS[1];

  // Feasibility Check & Effective Active Route Selection
  const noFeasibleRouteAvailable = useMemo(() => {
    return routes.length > 0 && routes.every(r => r.feasibilityResult && !r.feasibilityResult.feasible);
  }, [routes]);

  const effectiveActiveRoute = useMemo(() => {
    const currentFeasible = routes.find(r => r.id === activeRouteId && r.feasibilityResult?.feasible);
    if (currentFeasible) return currentFeasible;
    const firstFeasible = routes.find(r => r.feasibilityResult?.feasible);
    if (firstFeasible) return firstFeasible;
    return routes.find(r => r.id === activeRouteId) || routes[0];
  }, [routes, activeRouteId]);

  const activeRoute = effectiveActiveRoute;

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

      {/* No Feasible Route Alert Banner */}
      {noFeasibleRouteAvailable && (
        <div style={{ background: 'rgba(255, 75, 92, 0.95)', color: '#ffffff', padding: '8px 16px', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', zIndex: 100, boxShadow: '0 2px 10px rgba(255, 75, 92, 0.4)' }}>
          <AlertOctagon size={16} />
          <span>NO FEASIBLE ROUTE AVAILABLE for {activeVessel.name} [{activeVessel.polarClass}] — All route options exceed safe ice-breaking capacity under Day +{params.forecastDay} sea-ice conditions.</span>
        </div>
      )}

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
          totalVoyageDays={Math.ceil(activeRoute.totalTimeHours / 24)}
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
          originStationId={params.originStationId}
          destinationStationId={params.destinationStationId}
        />
      </div>

      {/* Telemetry Footer Bar */}
      <footer className="telemetry-bar">
        <div className="telemetry-card">
          <div className="telemetry-header">
            <Anchor size={13} className="telemetry-icon cyan" />
            <span className="telemetry-label">Active Expedition Track</span>
          </div>
          <div className="telemetry-val cyan">
            {originStation.name.split(' ')[0]} → {destStation.name.split(' ')[0]}
          </div>
        </div>

        <div className="telemetry-card">
          <div className="telemetry-header">
            <Ship size={13} className="telemetry-icon blue" />
            <span className="telemetry-label">Vessel & Class</span>
          </div>
          <div className="telemetry-val">
            {activeVessel.name.replace('Expedition Icebreaker', '')} <span className="class-badge">{activeVessel.polarClass}</span>
          </div>
        </div>

        <div className="telemetry-card">
          <div className="telemetry-header">
            <Compass size={13} className="telemetry-icon cyan" />
            <span className="telemetry-label">Total Distance</span>
          </div>
          <div className="telemetry-val">{activeRoute.totalDistanceNmi} <span className="unit">nmi</span></div>
        </div>

        <div className="telemetry-card">
          <div className="telemetry-header">
            <Clock size={13} className="telemetry-icon amber" />
            <span className="telemetry-label">Est. Voyage Time</span>
          </div>
          <div className="telemetry-val">
            {activeRoute.totalTimeHours} <span className="unit">hrs</span> <span className="sub-val">({(activeRoute.totalTimeHours / 24).toFixed(1)}d)</span>
          </div>
        </div>

        <div className="telemetry-card">
          <div className="telemetry-header">
            <Fuel size={13} className="telemetry-icon green" />
            <span className="telemetry-label">Est. Fuel Burn</span>
          </div>
          <div className="telemetry-val green">
            {activeRoute.fuelConsumedTons} <span className="unit">Tons MGO</span>
          </div>
        </div>

        <div className="telemetry-card highlight">
          <div className="telemetry-header">
            <ShieldCheck size={13} className="telemetry-icon cyan" />
            <span className="telemetry-label">Safety Index</span>
          </div>
          <div className="telemetry-val cyan" style={{ color: activeRoute.safetyScore.total > 80 ? '#38ef7d' : '#ffb703' }}>
            {activeRoute.safetyScore.total}<span className="unit">/100</span>
          </div>
          <div className="telemetry-subtext">
            Ice:{activeRoute.safetyScore.seaIceRisk} • Berg:{activeRoute.safetyScore.icebergRisk} • Wx:{activeRoute.safetyScore.weatherRisk}
          </div>
        </div>

        <div className="telemetry-card">
          <div className="telemetry-header">
            <Activity size={13} className="telemetry-icon green" />
            <span className="telemetry-label">Forecast Confidence</span>
          </div>
          <div className="telemetry-val" style={{ color: activeRoute.safetyScore.overallConfidencePct > 80 ? '#38ef7d' : '#ffb703' }}>
            {activeRoute.safetyScore.overallConfidencePct}%
          </div>
          <div className="telemetry-subtext">
            PINN Drift Model
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
