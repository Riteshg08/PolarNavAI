import { RouteOption, VesselProfile, RouteClearanceResult } from '../types';
import { SafetyScoreBreakdown } from '../risk/safetyScore';

export function generateRouteExplanation(
  route: RouteOption,
  alternativeRoutes: RouteOption[],
  vessel: VesselProfile,
  safetyBreakdown: SafetyScoreBreakdown,
  clearanceResult: RouteClearanceResult
): string {
  if (route.feasibilityResult && !route.feasibilityResult.feasible) {
    return `This route is STRUCTURALLY INFEASIBLE for the ${vessel.name}. It encounters pack ice concentrations exceeding the safe structural limits of a ${vessel.polarClass} vessel.`;
  }

  const parts: string[] = [];

  // Find baseline/shortest route to compare against
  const shortest = alternativeRoutes.find(r => r.id === 'SHORTEST_DISTANCE');
  const isShortest = route.id === 'SHORTEST_DISTANCE';
  
  if (!isShortest && shortest) {
    const fuelSavingsPct = Math.round(((shortest.fuelConsumedTons - route.fuelConsumedTons) / shortest.fuelConsumedTons) * 100);
    const iceAvoided = shortest.averageIceConcentrationPct - route.averageIceConcentrationPct;

    if (fuelSavingsPct > 0) {
       parts.push(`Reduces estimated fuel consumption by ${fuelSavingsPct}% compared to the direct Great Circle route`);
    } else {
       parts.push(`Sacrifices ${(Math.abs(fuelSavingsPct))}% fuel efficiency compared to the direct route`);
    }

    if (iceAvoided > 10) {
       parts.push(`successfully navigates around the highest-risk SIC regions (avoiding ${shortest.averageIceConcentrationPct}% average ice)`);
    }
  } else if (isShortest) {
    parts.push(`Prioritizes absolute minimum distance traveled`);
  }

  // Iceberg Clearance
  if (clearanceResult && clearanceResult.minSeparationNmi !== Infinity) {
     if (clearanceResult.overallStatus === 'SAFE') {
       parts.push(`maintains a safe ${clearanceResult.minSeparationNmi.toFixed(1)} nmi minimum iceberg clearance`);
     } else {
       parts.push(`accepts high proximity risk, passing within ${clearanceResult.minSeparationNmi.toFixed(1)} nmi of known iceberg drift vectors`);
     }
  }

  // Vessel compatibility
  parts.push(`remains within ${vessel.polarClass} operating limits`);

  // Risk Contributors
  const riskMap = [
    { name: 'Sea-Ice Density', score: safetyBreakdown.seaIceRisk },
    { name: 'Structural Ice Thickness', score: safetyBreakdown.iceThicknessRisk },
    { name: 'Weather/Wave', score: safetyBreakdown.weatherRisk },
    { name: 'Iceberg Proximity', score: safetyBreakdown.icebergRisk }
  ].sort((a, b) => b.score - a.score);

  const topRisks = riskMap.filter(r => r.score > 20).slice(0, 2);
  let riskStr = '';
  if (topRisks.length > 0) {
    riskStr = `. Note that the primary hazard contributors on this path are ${topRisks.map(r => r.name).join(' and ')}`;
  } else {
    riskStr = `. The path is considered low-hazard across all major metrics`;
  }

  let finalExplanation = `Recommended because it ${parts.join(', and ')}${riskStr}.`;

  if (route.id === 'SHORTEST_DISTANCE' && safetyBreakdown.total < 80) {
    finalExplanation = `This option minimizes transit time but carries significant hazards. It ${parts.join(', and ')}${riskStr}.`;
  }

  return finalExplanation;
}
