export type PolarClass = 'PC1' | 'PC3' | 'PC5' | 'PC7' | 'Non-Ice';

export interface VesselProfile {
  id: string;
  name: string;
  polarClass: PolarClass;
  lengthMeters: number;
  beamMeters: number;
  draftMeters: number;
  maxSpeedKnots: number;
  iceBreakingCapacityMeters: number; // Max ice thickness vessel can break
  baseFuelBurnTonsPerDay: number; // Tons of MGO / HFO per day
}

export interface Iceberg {
  id: string;
  name: string;
  lat: number;
  lon: number;
  lengthKm: number;
  widthKm: number;
  heightMeters: number;
  driftSpeedKnots: number;
  driftHeadingDeg: number;
  hazardLevel: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  trajectory7Day: { lat: number; lon: number; day: number }[];
  predictedTrajectory?: { day: number; lat: number; lon: number; uncertaintyRadiusKm: number }[];
  lastObserved: string;
  source: 'Sentinel-1 SAR' | 'BYU Scatterometer' | 'US NIC';
}

export interface StationLocation {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  type: 'Research Station' | 'Port of Origin' | 'Field Camp';
}

export interface Waypoint {
  lat: number;
  lon: number;
  iceConcentrationPct: number; // 0 - 100
  iceThicknessMeters: number;
  speedKnots: number;
  isWaypoint: boolean;
  name?: string;
  estimatedTimeHours?: number;
}

export interface SegmentClearance {
  segmentIndex: number;
  startWaypointName?: string;
  endWaypointName?: string;
  vesselLat: number;
  vesselLon: number;
  icebergId: string;
  icebergName: string;
  icebergLat: number;
  icebergLon: number;
  icebergUncertaintyNmi: number;
  timeHours: number;
  separationDistanceNmi: number;
  requiredClearanceNmi: number;
  status: 'SAFE' | 'WARNING' | 'DANGER';
  message: string;
}

export interface RouteClearanceResult {
  overallStatus: 'SAFE' | 'WARNING' | 'DANGER';
  segments: SegmentClearance[];
  minSeparationNmi: number;
  closestIceberg?: string;
}

export interface RouteFeasibilityResult {
  feasible: boolean;
  violations: string[];
  maxSafeIceConcentrationPct: number;
}

export interface TimeDependentRiskResult {
  waypointIndex: number;
  timeHours: number;
  forecastDayFloat: number;
  originalSicPct: number;
  timeAccurateSicPct: number;
  forecastConfidencePct: number;
}

import { SafetyScoreBreakdown } from '../risk/safetyScore';

export interface RouteOption {
  id: 'OPTIMAL_AI' | 'SHORTEST_DISTANCE' | 'CONVENTIONAL';
  title: string;
  waypoints: Waypoint[];
  totalDistanceNmi: number;
  totalTimeHours: number;
  fuelConsumedTons: number;
  co2EmissionsTons: number;
  co2SavedTons: number;
  averageIceConcentrationPct: number;
  safetyScore: SafetyScoreBreakdown;
  riskDescription: string;
  clearanceResult?: RouteClearanceResult;
  feasibilityResult?: RouteFeasibilityResult;
  timeDependentResults?: TimeDependentRiskResult[];
  dynamicExplanation?: string;
}

export interface SeaIceForecastParams {
  forecastDay: number; // 0 to 7 days ahead
  iceConcentrationThreshold: number; // Max concentration allowed in planner %
  optimizationWeight: 'BALANCED' | 'MIN_FUEL' | 'MAX_SAFETY' | 'FASTEST';
  selectedVesselId: string;
  originStationId: string;
  destinationStationId: string;
}

export interface AIModelPipelineStatus {
  uNetSeaIceSSIM: number; // e.g. 0.942
  uNetSeaIceRMSE: number; // e.g. 3.4%
  pinnIcebergDriftRMSEKm24h: number; // e.g. 2.1 km
  sentinel1LastUpdated: string;
  amsr2LastUpdated: string;
  era5LastUpdated: string;
  hycomLastUpdated: string;
  activeModelVersion: string;
}
