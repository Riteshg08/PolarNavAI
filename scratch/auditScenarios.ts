import { ROUTE_SCENARIOS } from '../src/utils/routeScenarios';
import { checkRouteFeasibility, getMaxSafeIceConcentration } from '../src/risk/vesselConstraints';
import { VESSELS } from '../src/data/vessels';
import { RouteOption } from '../src/types';

const pc3Vessel = VESSELS.find(v => v.polarClass === 'PC3') || VESSELS[0];

console.log(`=== AUDITING ROUTE SCENARIOS AGAINST ${pc3Vessel.name} (${pc3Vessel.polarClass}) ===`);
console.log(`Max Safe Ice Limit: ${getMaxSafeIceConcentration(pc3Vessel)}%\n`);

let totalScenarios = 0;
let aiViolationsCount = 0;
let directViolationsCount = 0;
let convViolationsCount = 0;

ROUTE_SCENARIOS.forEach(scenario => {
  console.log(`📍 Pair: ${scenario.originId} -> ${scenario.destinationId}`);
  scenario.days.forEach(dayData => {
    totalScenarios++;
    
    // Construct dummy RouteOptions for audit
    const aiRoute: RouteOption = {
      id: 'OPTIMAL_AI',
      title: 'AI Optimal Route',
      waypoints: dayData.aiWaypoints,
      totalDistanceNmi: 1000,
      totalTimeHours: 100,
      fuelConsumedTons: 100,
      co2EmissionsTons: 300,
      co2SavedTons: 10,
      averageIceConcentrationPct: dayData.rationale.iceConcentrationComparison.aiRouteAvgPct,
      safetyScore: { total: 90, seaIceRisk: 90, icebergRisk: 90, weatherRisk: 90, vesselRisk: 90, overallConfidencePct: 90 },
      riskDescription: ''
    };

    const directRoute: RouteOption = {
      id: 'SHORTEST_DISTANCE',
      title: 'Direct Route',
      waypoints: dayData.directWaypoints,
      totalDistanceNmi: 900,
      totalTimeHours: 90,
      fuelConsumedTons: 90,
      co2EmissionsTons: 270,
      co2SavedTons: 0,
      averageIceConcentrationPct: dayData.rationale.iceConcentrationComparison.directRouteAvgPct,
      safetyScore: { total: 50, seaIceRisk: 50, icebergRisk: 50, weatherRisk: 50, vesselRisk: 50, overallConfidencePct: 70 },
      riskDescription: ''
    };

    const aiRes = checkRouteFeasibility(aiRoute, pc3Vessel);
    const directRes = checkRouteFeasibility(directRoute, pc3Vessel);

    let maxAiIce = 0;
    dayData.aiWaypoints.forEach(wp => { if (wp.iceConcentrationPct > maxAiIce) maxAiIce = wp.iceConcentrationPct; });

    let maxDirectIce = 0;
    dayData.directWaypoints.forEach(wp => { if (wp.iceConcentrationPct > maxDirectIce) maxDirectIce = wp.iceConcentrationPct; });

    if (!aiRes.feasible) {
      aiViolationsCount++;
      console.log(` ❌ Day ${dayData.day} AI Route VIOLATION: Max Ice = ${maxAiIce.toFixed(1)}% | ${aiRes.violations[0]}`);
    } else {
      console.log(` ✅ Day ${dayData.day} AI Route Safe (Max Ice: ${maxAiIce.toFixed(1)}%)`);
    }

    if (!directRes.feasible) {
      directViolationsCount++;
    }
  });
  console.log('--------------------------------------------------');
});

console.log(`\nSUMMARY:`);
console.log(`Total Days Evaluated: ${totalScenarios}`);
console.log(`AI Route Feasibility Violations: ${aiViolationsCount}`);
console.log(`Direct Route Feasibility Violations: ${directViolationsCount}`);
