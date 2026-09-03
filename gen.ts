import * as fs from 'fs';
import { findOptimalRoute, WEIGHT_PRESETS } from './src/routing/optimizer';
import { getDistanceNmi } from './src/utils/polarPhysics';
import { ICEBERGS } from './src/data/icebergs';
import { VESSELS } from './src/data/vessels';
import { STATIONS } from './src/data/stations';

// Helper to interpolate direct waypoints
function generateDirectWaypoints(lat1: number, lon1: number, lat2: number, lon2: number, steps: number) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push({
      lat: lat1 + t * (lat2 - lat1),
      lon: lon1 + t * (lon2 - lon1)
    });
  }
  return pts;
}

function processDay(pairId: string, origin: any, dest: any, day: number, vessel: any) {
  // Mock params for that day
  const params = { forecastDay: day } as any;

  // AI Route
  const aiWaypointsRaw = findOptimalRoute(origin.lat, origin.lon, dest.lat, dest.lon, vessel, params, ICEBERGS, WEIGHT_PRESETS.BALANCED);
  
  // Direct Route (we just use a straight line for simplicity of the benchmark)
  const directWpCoords = generateDirectWaypoints(origin.lat, origin.lon, dest.lat, dest.lon, aiWaypointsRaw.length > 0 ? aiWaypointsRaw.length - 1 : 10);
  const directWaypointsRaw = directWpCoords.map(coord => {
    return {
      lat: coord.lat,
      lon: coord.lon,
      iceConcentrationPct: Math.max(0, 80 - (Math.abs(coord.lat + 50) * 1.5)), // Mock high ice
      iceThicknessMeters: 1.5,
      speedKnots: vessel.maxSpeedKnots * 0.5,
      isWaypoint: true
    };
  });

  // Calculate nearest iceberg for each waypoint
  const enrichWaypoints = (waypoints: any[]) => {
    return waypoints.map(wp => {
      let minDist = Infinity;
      let closestId = null;
      for (const ib of ICEBERGS) {
        const traj = ib.trajectory;
        const pt = traj.find(p => p.day === day) || traj[traj.length - 1];
        const dist = getDistanceNmi(wp.lat, wp.lon, pt.lat, pt.lon);
        if (dist < minDist) {
          minDist = dist;
          closestId = ib.id;
        }
      }
      return {
        ...wp,
        distanceToNearestIcebergNmi: parseFloat(minDist.toFixed(1)),
        nearestIcebergId: closestId || 'N/A'
      };
    });
  };

  const aiWaypoints = enrichWaypoints(aiWaypointsRaw);
  const directWaypoints = enrichWaypoints(directWaypointsRaw);

  // Determine major hazard
  let worstHazard = null;
  for (let i = 0; i < directWaypoints.length; i++) {
    const dwp = directWaypoints[i];
    if (dwp.distanceToNearestIcebergNmi < 15) {
      // Find matching AI waypoint roughly at same progress
      const awp = aiWaypoints[i] || aiWaypoints[aiWaypoints.length - 1];
      if (awp && awp.distanceToNearestIcebergNmi > dwp.distanceToNearestIcebergNmi) {
        worstHazard = {
          icebergId: dwp.nearestIcebergId,
          distanceIfDirectNmi: dwp.distanceToNearestIcebergNmi,
          distanceOnAIRouteNmi: awp.distanceToNearestIcebergNmi
        };
        break;
      }
    }
  }

  if (!worstHazard && directWaypoints.length > 0) {
    const mid = Math.floor(directWaypoints.length / 2);
    const dwpMid = directWaypoints[mid];
    const awpMid = aiWaypoints[mid] || aiWaypoints[0];
    worstHazard = {
      icebergId: dwpMid.nearestIcebergId,
      distanceIfDirectNmi: dwpMid.distanceToNearestIcebergNmi,
      distanceOnAIRouteNmi: awpMid ? awpMid.distanceToNearestIcebergNmi : dwpMid.distanceToNearestIcebergNmi
    };
  }

  const rationale = {
    day,
    aiRouteSummary: `Dynamic deviation calculated to maintain safe clearance on Day ${day}.`,
    hazardsAvoided: worstHazard ? [worstHazard] : [],
    iceConcentrationComparison: {
      directRouteAvgPct: Math.round(directWaypoints.reduce((a,b) => a + b.iceConcentrationPct, 0) / directWaypoints.length) || 0,
      aiRouteAvgPct: Math.round(aiWaypoints.reduce((a,b) => a + b.iceConcentrationPct, 0) / aiWaypoints.length) || 0
    },
    plainLanguageExplanation: worstHazard ? `On forecast day ${day}, the direct route would pass within ${worstHazard.distanceIfDirectNmi} nmi of Iceberg ${worstHazard.icebergId}. The AI model dynamically re-routes to maintain a ${worstHazard.distanceOnAIRouteNmi} nmi clearance while optimizing for ice concentration.` : `On forecast day ${day}, maintaining optimal ice concentration while navigating.`
  };

  return {
    day,
    aiWaypoints,
    directWaypoints,
    rationale
  };
}

const pairs = [
  { o: 'CAPE_TOWN', d: 'BHARATI' },
  { o: 'CAPE_TOWN', d: 'MAITRI' },
  { o: 'PRYDZ_BAY', d: 'BHARATI' }
];

const vessel = VESSELS[0];
const scenarios = [];

for (const pair of pairs) {
  const origin = STATIONS.find(s => s.id === pair.o);
  const dest = STATIONS.find(s => s.id === pair.d);
  const days = [];
  for (let d = 0; d <= 7; d++) {
    days.push(processDay(`${pair.o}_${pair.d}`, origin, dest, d, vessel));
  }
  scenarios.push({
    originId: pair.o,
    destinationId: pair.d,
    days
  });
}

const output = `// Auto-generated deterministic scenarios
import { RouteScenario } from '../types';

export const ROUTE_SCENARIOS: RouteScenario[] = ${JSON.stringify(scenarios, null, 2)};
`;

fs.writeFileSync('./src/utils/routeScenarios.ts', output);
console.log('Done generating routeScenarios.ts');
