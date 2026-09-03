import { RouteOption, VesselProfile, Iceberg } from '../types';

export interface SafetyScoreBreakdown {
  total: number;
  seaIceRisk: number;
  iceThicknessRisk: number;
  icebergRisk: number;
  weatherRisk: number;
  vesselRisk: number;
  clearanceRisk: number;
  confidenceRisk: number;
  overallConfidencePct: number;
}

export function computeSafetyScore(route: RouteOption, vessel: VesselProfile, icebergs: Iceberg[]): SafetyScoreBreakdown {
  // 1. Sea Ice Risk: derived from average and max SIC along the route
  const avgSic = route.averageIceConcentrationPct || 0;
  let maxSic = 0;
  route.waypoints.forEach(wp => {
    if (wp.iceConcentrationPct > maxSic) maxSic = wp.iceConcentrationPct;
  });
  // Scale 0-100 where higher SIC gives higher risk
  const seaIceRisk = Math.min(100, (avgSic + maxSic) / 2);

  // 2. Ice Thickness Risk: related to vessel's structural capability
  // Compares average ice thickness to vessel's ice breaking capacity
  const avgThickness = route.waypoints.reduce((acc, wp) => acc + (wp.iceThicknessMeters || 0), 0) / Math.max(1, route.waypoints.length);
  const iceThicknessRisk = Math.min(100, (avgThickness / Math.max(0.1, vessel.iceBreakingCapacityMeters)) * 50);

  // 3. Iceberg Risk & Clearance Risk
  let icebergRisk = 0;
  let clearanceRisk = 0;
  
  if (route.clearanceResult) {
    // Iceberg density risk based on number of segments close to icebergs
    const warnings = route.clearanceResult.segments.filter(s => s.status === 'WARNING').length;
    const dangers = route.clearanceResult.segments.filter(s => s.status === 'DANGER').length;
    icebergRisk = Math.min(100, warnings * 10 + dangers * 20);
    
    // Overall absolute clearance risk based on worst status
    if (route.clearanceResult.overallStatus === 'DANGER') clearanceRisk = 100;
    else if (route.clearanceResult.overallStatus === 'WARNING') clearanceRisk = 50;
  }

  // 4. Vessel Risk (structural / feasibility violations)
  let vesselRisk = 0;
  if (route.feasibilityResult) {
    if (!route.feasibilityResult.feasible) {
      vesselRisk = 100;
    } else {
      // Baseline risk depending on polar class (weaker vessels have intrinsically higher risk in polar waters)
      const classRiskMap: Record<string, number> = { 'PC1': 0, 'PC3': 10, 'PC5': 20, 'PC7': 40, 'Non-Ice': 80 };
      vesselRisk = classRiskMap[vessel.polarClass] || 0;
    }
  }

  // 5. Weather Risk (mock derived from latitude - deeper south = structurally worse weather)
  const maxLat = Math.max(...route.waypoints.map(wp => Math.abs(wp.lat)));
  const weatherRisk = Math.min(100, Math.max(0, (maxLat - 50) * 2)); 

  // 6. Confidence Risk (uncertainty over time)
  let overallConfidencePct = 95; // Default high confidence for day 0 short routes
  if (route.timeDependentResults && route.timeDependentResults.length > 0) {
    const avgConf = route.timeDependentResults.reduce((acc, r) => acc + r.forecastConfidencePct, 0) / route.timeDependentResults.length;
    overallConfidencePct = avgConf;
  }
  const confidenceRisk = Math.max(0, 100 - overallConfidencePct);

  // Combined Total Calculation
  // We use a weighted sum of the sub-risks to compute the total penalty.
  // Weights: SeaIce (20%), IceThickness (20%), Clearance/Iceberg (25%), Vessel Feasibility (15%), Weather (10%), Confidence (10%)
  const weightedPenalty = 
    (seaIceRisk * 0.20) + 
    (iceThicknessRisk * 0.20) + 
    (Math.max(icebergRisk, clearanceRisk) * 0.25) + 
    (vesselRisk * 0.15) + 
    (weatherRisk * 0.10) +
    (confidenceRisk * 0.10);

  const total = Math.max(0, Math.min(100, 100 - weightedPenalty));

  return {
    total: Math.round(total),
    seaIceRisk: Math.round(seaIceRisk),
    iceThicknessRisk: Math.round(iceThicknessRisk),
    icebergRisk: Math.round(icebergRisk),
    weatherRisk: Math.round(weatherRisk),
    vesselRisk: Math.round(vesselRisk),
    clearanceRisk: Math.round(clearanceRisk),
    confidenceRisk: Math.round(confidenceRisk),
    overallConfidencePct: Math.round(overallConfidencePct)
  };
}
