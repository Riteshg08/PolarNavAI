import { RouteOption, VesselProfile } from '../types';

export interface RouteFeasibilityResult {
  feasible: boolean;
  violations: string[];
  maxSafeIceConcentrationPct: number;
}

export function getMaxSafeIceConcentration(vessel: VesselProfile): number {
  // A vessel's ice breaking capacity is rated in meters. 
  // We map its Polar Class capacity to a maximum safe sea-ice concentration percentage.
  if (vessel.polarClass === 'PC1') return 100; // Can operate in year-round polar conditions
  if (vessel.polarClass === 'PC3') return 95;  // Multi-year ice capable
  if (vessel.polarClass === 'PC5') return 85;  // Medium first-year ice
  if (vessel.polarClass === 'PC7') return 70;  // Thin first-year ice
  return 40; // Non-Ice classed vessels must avoid significant ice
}

export function checkRouteFeasibility(route: RouteOption, vessel: VesselProfile): RouteFeasibilityResult {
  const maxSafeIceConcentrationPct = getMaxSafeIceConcentration(vessel);
  const violations: string[] = [];

  // Check ice concentration constraints
  let iceViolations = 0;
  let maxIceEncountered = 0;

  for (const wp of route.waypoints) {
    if (wp.iceConcentrationPct > maxSafeIceConcentrationPct) {
      iceViolations++;
    }
    if (wp.iceConcentrationPct > maxIceEncountered) {
      maxIceEncountered = wp.iceConcentrationPct;
    }
  }

  if (iceViolations > 0) {
    violations.push(`Exceeds ${vessel.polarClass} (${vessel.iceBreakingCapacityMeters}m) ice-breaking capacity along ${iceViolations} segment(s). Max encountered: ${maxIceEncountered}% (Limit: ${maxSafeIceConcentrationPct}%).`);
  }

  return {
    feasible: violations.length === 0,
    violations,
    maxSafeIceConcentrationPct
  };
}
