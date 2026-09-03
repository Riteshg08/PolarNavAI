import { StationLocation, VesselProfile, Iceberg, RouteOption, Waypoint, SeaIceForecastParams } from '../types';

import { STATIONS } from '../data/stations';
import { VESSELS } from '../data/vessels';
import { evaluateRouteClearance } from '../risk/clearanceEngine';
import { checkRouteFeasibility } from '../risk/vesselConstraints';
import { evaluateRouteOverTime } from '../routing/timeDependentEval';
import { computeSafetyScore } from '../risk/safetyScore';
import { generateRouteExplanation } from '../explain/routeExplanation';
import { getSicAt } from '../models/seaIceForecast';
import { findOptimalRoute, WEIGHT_PRESETS } from '../routing/optimizer';

// Great Circle Distance calculation (in Nautical Miles) do points k bech ka distance find krne k liye ye function hai 
export function getDistanceNmi(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R_km = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distKm = R_km * c;
  return distKm * 0.539957; // km to Nautical Miles
}

// Hydrodynamic Physics simulation for iceberg drift
export function simulateIcebergDriftRK4(
  iceberg: Iceberg,
  windSpeedKnots: number,
  windDirDeg: number,
  oceanSpeedKnots: number,
  oceanDirDeg: number,
  hoursForecast: number
): { lat: number; lon: number } {
  // Drag coefficients
  const C_air = 0.0015;    // Air Drag Coefficient (Hawa ka gharsan)
const C_water = 0.005;   // Water Drag Coefficient (Paani ka gharsan)
const rho_air = 1.25;    // Hawa ki density (kg/m³)
const rho_water = 1027;  // Khare paani ki density (kg/m³)


  // Convert directions to radians
  const windRad = (windDirDeg * Math.PI) / 180;
  const oceanRad = (oceanDirDeg * Math.PI) / 180;

  // Velocity components
  const U_w = windSpeedKnots * Math.sin(windRad);
  const V_w = windSpeedKnots * Math.cos(windRad);
  const U_o = oceanSpeedKnots * Math.sin(oceanRad);
  const V_o = oceanSpeedKnots * Math.cos(oceanRad);

  // Approximate drift vector (Ocean current dominates ~80%, Wind ~2% + Coriolis drift ~30 deg left in Southern Hemisphere)
  const U_drift = 0.82 * U_o + 0.025 * U_w - 0.005 * V_w;
  const V_drift = 0.82 * V_o + 0.025 * V_w + 0.005 * U_w;

  // Distance traveled in degrees over hoursForecast
  const deltaNmi = Math.sqrt(U_drift * U_drift + V_drift * V_drift) * hoursForecast;
  const headingRad = Math.atan2(U_drift, V_drift);

  const deltaLat = (deltaNmi / 60) * Math.cos(headingRad);
  const deltaLon = (deltaNmi / (60 * Math.cos((iceberg.lat * Math.PI) / 180))) * Math.sin(headingRad);

  return {
    lat: iceberg.lat + deltaLat,
    lon: iceberg.lon + deltaLon
  };
}

// Generate Polar Pathfinding Routes
export function solvePolarRoutes(params: SeaIceForecastParams, icebergs: Iceberg[]): RouteOption[] {
  const origin = STATIONS.find((s) => s.id === params.originStationId) || STATIONS[0];
  const dest = STATIONS.find((s) => s.id === params.destinationStationId) || STATIONS[1];
  const vessel = VESSELS.find((v) => v.id === params.selectedVesselId) || VESSELS[0];

  const directDist = getDistanceNmi(origin.lat, origin.lon, dest.lat, dest.lon);

  // 1. OPTIMAL AI ROUTE (A* Grid Pathfinding)
  const weightsAI = WEIGHT_PRESETS[params.optimizationWeight] || WEIGHT_PRESETS.BALANCED;
  const waypointsAI = findOptimalRoute(origin.lat, origin.lon, dest.lat, dest.lon, vessel, params, icebergs, weightsAI);

  let cumulativeTimeAI = 0;
  let distAI = 0;
  waypointsAI.forEach((wp, i) => {
    if (i > 0) {
      const prev = waypointsAI[i - 1];
      const segDist = getDistanceNmi(prev.lat, prev.lon, wp.lat, wp.lon);
      distAI += segDist;
      cumulativeTimeAI += segDist / prev.speedKnots;
      wp.estimatedTimeHours = cumulativeTimeAI;
    } else {
      wp.estimatedTimeHours = 0;
    }
  });

  const avgSpeedAI = waypointsAI.reduce((a, b) => a + b.speedKnots, 0) / waypointsAI.length;
  const timeAI = cumulativeTimeAI;
  const fuelAI = parseFloat(((timeAI / 24) * vessel.baseFuelBurnTonsPerDay).toFixed(1)); 
  const co2AI = parseFloat((fuelAI * 3.114).toFixed(1));
  const avgIceAI = Math.round(waypointsAI.reduce((a, b) => a + b.iceConcentrationPct, 0) / waypointsAI.length);

  // 2. SHORTEST DISTANCE (Great Circle Baseline)
  const waypointsShortest: Waypoint[] = [];
  const stepsShortest = 15;

  for (let i = 0; i <= stepsShortest; i++) {
    let t = i / stepsShortest;
    let lat = origin.lat + t * (dest.lat - origin.lat);
    let lon = origin.lon + t * (dest.lon - origin.lon);

    const baseSic = getSicAt(lat, lon, params.forecastDay);
    const iceConc = Math.min(98, baseSic + 15); // Direct route hits heavier pack ice
    const actualSpeed = Math.max(2.5, vessel.maxSpeedKnots * (1 - (iceConc / 100) * 0.7));

    waypointsShortest.push({
      lat,
      lon,
      iceConcentrationPct: Math.round(iceConc),
      iceThicknessMeters: (iceConc / 100) * 2.5,
      speedKnots: actualSpeed,
      isWaypoint: true
    });
  }

  let cumulativeTimeShort = 0;
  waypointsShortest.forEach((wp, i) => {
    if (i > 0) {
      const prev = waypointsShortest[i - 1];
      const segDist = getDistanceNmi(prev.lat, prev.lon, wp.lat, wp.lon);
      cumulativeTimeShort += segDist / prev.speedKnots;
      wp.estimatedTimeHours = cumulativeTimeShort;
    } else {
      wp.estimatedTimeHours = 0;
    }
  });

  const distShort = Math.round(directDist);
  const avgSpeedShort = waypointsShortest.reduce((a, b) => a + b.speedShort, 0) / waypointsShortest.length || 0;
  const timeShort = cumulativeTimeShort;
  const fuelShort = parseFloat(((timeShort / 24) * vessel.baseFuelBurnTonsPerDay).toFixed(1));
  const co2Short = parseFloat((fuelShort * 3.114).toFixed(1));
  const avgIceShort = Math.round(waypointsShortest.reduce((a, b) => a + b.iceConcentrationPct, 0) / Math.max(1, waypointsShortest.length));

  // 3. CONVENTIONAL COASTAL ROUTE (A* with MAX_SAFETY)
  const waypointsConv = findOptimalRoute(origin.lat, origin.lon, dest.lat, dest.lon, vessel, params, icebergs, WEIGHT_PRESETS.MAX_SAFETY);

  let cumulativeTimeConv = 0;
  let distConv = 0;
  waypointsConv.forEach((wp, i) => {
    if (i > 0) {
       const prev = waypointsConv[i - 1];
       const segDist = getDistanceNmi(prev.lat, prev.lon, wp.lat, wp.lon);
       distConv += segDist;
       cumulativeTimeConv += segDist / prev.speedKnots;
       wp.estimatedTimeHours = cumulativeTimeConv;
    } else {
       wp.estimatedTimeHours = 0;
    }
  });

  const avgSpeedConv = waypointsConv.reduce((a, b) => a + b.speedKnots, 0) / Math.max(1, waypointsConv.length);
  const timeConv = cumulativeTimeConv;
  const fuelConv = parseFloat(((timeConv / 24) * vessel.baseFuelBurnTonsPerDay).toFixed(1));
  const co2Conv = parseFloat((fuelConv * 3.114).toFixed(1));
  const avgIceConv = Math.round(waypointsConv.reduce((a, b) => a + b.iceConcentrationPct, 0) / Math.max(1, waypointsConv.length));

  const routes: RouteOption[] = [
    {
      id: 'OPTIMAL_AI',
      title: 'PolarNav AI Optimal Channel Route',
      waypoints: waypointsAI,
      totalDistanceNmi: Math.round(distAI),
      totalTimeHours: Math.round(timeAI),
      fuelConsumedTons: fuelAI,
      co2EmissionsTons: co2AI,
      co2SavedTons: parseFloat((co2Short - co2AI).toFixed(1)),
      averageIceConcentrationPct: avgIceAI,
      safetyScore: null as any, // assigned below
      riskDescription: '' // assigned below
    },
    {
      id: 'SHORTEST_DISTANCE',
      title: 'Great Circle Direct Route (High Hazard)',
      waypoints: waypointsShortest,
      totalDistanceNmi: Math.round(distShort),
      totalTimeHours: Math.round(timeShort),
      fuelConsumedTons: fuelShort,
      co2EmissionsTons: co2Short,
      co2SavedTons: 0,
      averageIceConcentrationPct: avgIceShort,
      safetyScore: null as any, // assigned below
      riskDescription: '' // assigned below
    },
    {
      id: 'CONVENTIONAL',
      title: 'Standard Coastal Track',
      waypoints: waypointsConv,
      totalDistanceNmi: Math.round(distConv),
      totalTimeHours: Math.round(timeConv),
      fuelConsumedTons: fuelConv,
      co2EmissionsTons: co2Conv,
      co2SavedTons: parseFloat((co2Short - co2Conv).toFixed(1)),
      averageIceConcentrationPct: avgIceConv,
      safetyScore: null as any, // assigned below
      riskDescription: '' // assigned below
    }
  ];

  // Time-Dependent Evaluation (Morph SIC and project risk along actual voyage timeline)
  routes.forEach(route => {
    route.timeDependentResults = evaluateRouteOverTime(route);
  });

  // Evaluate clearance and feasibility for all routes using the time-morphed waypoints
  routes.forEach(route => {
    route.clearanceResult = evaluateRouteClearance(route, icebergs);
    route.feasibilityResult = checkRouteFeasibility(route, vessel);
    
    // Compute objective, comprehensive safety score breakdown
    route.safetyScore = computeSafetyScore(route, vessel, icebergs);

    if (!route.feasibilityResult.feasible) {
      route.riskDescription = 'CRITICAL WARNING: Structural Limits Exceeded';
    } else if (route.clearanceResult.overallStatus !== 'SAFE') {
      route.riskDescription = `WARNING: High Iceberg Proximity Risk (${route.clearanceResult.minSeparationNmi.toFixed(1)} nmi)`;
    } else if (route.safetyScore.total < 80) {
      route.riskDescription = `ELEVATED RISK: Heavy Pack Ice (>85%) • High Risk of Ice Besetment`;
    } else {
      route.riskDescription = `Low Hazard Profile • Clearance > ${route.clearanceResult.minSeparationNmi.toFixed(1)} nmi • Feasible Route`;
    }
  });

  // Second pass to generate contextual explanations since we need alternative routes to compare against
  routes.forEach(route => {
    route.dynamicExplanation = generateRouteExplanation(
      route, 
      routes, 
      vessel, 
      route.safetyScore, 
      route.clearanceResult!
    );
  });

  return routes;
}
