import { VesselProfile, Iceberg, SeaIceForecastParams } from '../types';
import { getSicAt } from '../models/seaIceForecast';
import { getDistanceNmi } from '../utils/polarPhysics';
import { getMaxSafeIceConcentration } from '../risk/vesselConstraints';

export interface GridNode {
  lat: number;
  lon: number;
}

// Convert continuous lat/lon to grid indices (1 degree resolution)
export function getNearestNode(lat: number, lon: number): GridNode {
  return {
    lat: Math.round(lat),
    lon: Math.round(lon)
  };
}

export function getNeighbors(node: GridNode): GridNode[] {
  const neighbors: GridNode[] = [];
  const latDirs = [-1, 0, 1];
  const lonDirs = [-1, 0, 1];

  for (const dLat of latDirs) {
    for (const dLon of lonDirs) {
      if (dLat === 0 && dLon === 0) continue;
      
      let nLat = node.lat + dLat;
      let nLon = node.lon + dLon;

      // Restrict to Southern Ocean bounds
      if (nLat > -30 || nLat < -85) continue;

      // Wrap longitude around the globe
      if (nLon > 180) nLon -= 360;
      if (nLon < -180) nLon += 360;

      neighbors.push({ lat: nLat, lon: nLon });
    }
  }

  return neighbors;
}

export interface CostWeights {
  distanceWeight: number;
  fuelWeight: number;
  seaIceRiskWeight: number;
  icebergRiskWeight: number;
  weatherRiskWeight: number;
}

export function getCellCost(
  fromNode: GridNode,
  toNode: GridNode,
  vessel: VesselProfile,
  params: SeaIceForecastParams,
  icebergs: Iceberg[],
  weights: CostWeights
): number {
  // 1. Geographic distance
  const distNmi = getDistanceNmi(fromNode.lat, fromNode.lon, toNode.lat, toNode.lon);

  // 2. Sea-ice concentration at destination node
  const sic = getSicAt(toNode.lat, toNode.lon, params.forecastDay);
  
  // Vessel constraint: If ice concentration is extreme and vessel is low class, it's impassable
  const maxPassableSic = getMaxSafeIceConcentration(vessel);

  if (sic > maxPassableSic) {
    return Infinity; // Impassable for this vessel
  }

  // Calculate speed and fuel
  const speedKnots = Math.max(2.5, vessel.maxSpeedKnots * (1 - (sic / 100) * (vessel.polarClass === 'PC1' ? 0.3 : 0.7)));
  const timeHours = distNmi / speedKnots;
  const fuelTons = (timeHours / 24) * vessel.baseFuelBurnTonsPerDay;

  // 3. Iceberg Proximity Risk
  let icebergPenalty = 0;
  let minIcebergDist = Infinity;
  const dayIdx = Math.floor(params.forecastDay);
  for (const iceberg of icebergs) {
    // Exact daily projection based on forecast day
    const traj = iceberg.trajectory;
    const pos = traj.find(p => p.day === dayIdx) || traj[traj.length - 1];
    const dist = getDistanceNmi(toNode.lat, toNode.lon, pos.lat, pos.lon);
    if (dist < minIcebergDist) minIcebergDist = dist;
    
    // Calculate required clearance based on iceberg size (1 nmi = 1.852 km)
    const icebergRadiusNmi = (iceberg.lengthKm / 2) / 1.852;
    const clearanceNmi = icebergRadiusNmi + 25; // 25 nmi safety buffer
    
    if (dist < clearanceNmi) {
      icebergPenalty += Math.pow((clearanceNmi + 5) - dist, 3) * 100; // Massive penalty
    }
  }

  // 4. Weather / Ocean drag (mock placeholder)
  // Penalize extreme southern latitudes where weather is structurally worse if other factors are equal
  const weatherPenalty = (Math.abs(toNode.lat + 60) / 20) * 10;

  // Apply Cost Weights
  let cost = 0;
  cost += distNmi * weights.distanceWeight;
  cost += fuelTons * weights.fuelWeight * 12; // Scale fuel factor for relative parity with distance
  cost += Math.pow(sic, 1.3) * weights.seaIceRiskWeight; // Non-linear penalty for heavy ice
  cost += icebergPenalty * weights.icebergRiskWeight;
  cost += weatherPenalty * weights.weatherRiskWeight;

  return cost;
}
