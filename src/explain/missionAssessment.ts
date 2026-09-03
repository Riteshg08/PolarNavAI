import { RouteOption, VesselProfile, StationLocation, SeaIceForecastParams, RouteClearanceResult, RouteFeasibilityResult } from '../types';
import { SafetyScoreBreakdown } from '../risk/safetyScore';

export interface MissionAssessment {
  vesselName: string;
  polarClass: string;
  originName: string;
  destinationName: string;
  forecastDay: number;
  distanceNmi: number;
  estimatedTimeHours: number;
  estimatedFuelTons: number;
  minSicPct: number;
  maxSicPct: number;
  minIcebergClearanceNmi: number | null;
  safetyScoreTotal: number;
  predictionConfidencePct: number;
  activeWarnings: string[];
  overallStatus: 'FEASIBLE' | 'CAUTION' | 'UNSAFE';
}

export function generateMissionAssessment(
  route: RouteOption, 
  vessel: VesselProfile, 
  origin: StationLocation, 
  dest: StationLocation, 
  params: SeaIceForecastParams, 
  safetyBreakdown: SafetyScoreBreakdown, 
  clearanceResult: RouteClearanceResult, 
  feasibility: RouteFeasibilityResult
): MissionAssessment {
  
  const activeWarnings: string[] = [];
  let overallStatus: 'FEASIBLE' | 'CAUTION' | 'UNSAFE' = 'FEASIBLE';

  // 1. Feasibility Constraints (Structural Ice Limits)
  if (!feasibility.feasible) {
    overallStatus = 'UNSAFE';
    feasibility.violations.forEach(v => activeWarnings.push(`STRUCTURAL VIOLATION: ${v}`));
  }

  // 2. Iceberg Clearance Constraints
  if (clearanceResult.overallStatus === 'DANGER') {
    overallStatus = 'UNSAFE';
  } else if (clearanceResult.overallStatus === 'WARNING' && overallStatus !== 'UNSAFE') {
    overallStatus = 'CAUTION';
  }

  clearanceResult.segments.forEach(seg => {
    if (seg.status !== 'SAFE') {
      activeWarnings.push(`ICEBERG ${seg.status}: ${seg.message}`);
    }
  });

  // 3. Safety Score Thresholds
  if (safetyBreakdown.total < 50) {
    overallStatus = 'UNSAFE';
    activeWarnings.push(`CRITICAL RISK: Overall Route Safety Score is dangerously low (${safetyBreakdown.total}/100).`);
  } else if (safetyBreakdown.total < 80 && overallStatus !== 'UNSAFE') {
    overallStatus = 'CAUTION';
    activeWarnings.push(`ELEVATED RISK: Safety Score is marginal (${safetyBreakdown.total}/100). Proceed with caution.`);
  }

  // If no warnings were generated, add a clean bill of health
  if (activeWarnings.length === 0) {
    activeWarnings.push("No significant hazards detected along this route. Vessel parameters are within safe operational limits.");
  }

  let minSicPct = 100;
  let maxSicPct = 0;
  route.waypoints.forEach(wp => {
    if (wp.iceConcentrationPct < minSicPct) minSicPct = wp.iceConcentrationPct;
    if (wp.iceConcentrationPct > maxSicPct) maxSicPct = wp.iceConcentrationPct;
  });

  return {
    vesselName: vessel.name,
    polarClass: vessel.polarClass,
    originName: origin.name,
    destinationName: dest.name,
    forecastDay: params.forecastDay,
    distanceNmi: route.totalDistanceNmi,
    estimatedTimeHours: route.totalTimeHours,
    estimatedFuelTons: route.fuelConsumedTons,
    minSicPct: minSicPct === 100 && maxSicPct === 0 ? 0 : minSicPct, // Handle edge case if no waypoints
    maxSicPct,
    minIcebergClearanceNmi: clearanceResult.minSeparationNmi === Infinity ? null : clearanceResult.minSeparationNmi,
    safetyScoreTotal: safetyBreakdown.total,
    predictionConfidencePct: safetyBreakdown.overallConfidencePct,
    activeWarnings,
    overallStatus
  };
}
