import { RouteOption } from '../types';
import { getSicAt } from '../models/seaIceForecast';

export interface TimeDependentRiskResult {
  waypointIndex: number;
  timeHours: number;
  forecastDayFloat: number;
  originalSicPct: number;
  timeAccurateSicPct: number;
  forecastConfidencePct: number;
}

export function evaluateRouteOverTime(route: RouteOption): TimeDependentRiskResult[] {
  const results: TimeDependentRiskResult[] = [];

  route.waypoints.forEach((wp, idx) => {
    // 1. Convert estimated arrival hours to a fractional forecast day
    const timeHours = wp.estimatedTimeHours || 0;
    const forecastDayFloat = timeHours / 24;

    const originalSicPct = wp.iceConcentrationPct;

    // 2. Query sea-ice forecast at that exact temporal point.
    // (In our deterministic model, getSicAt natively supports floats. For discrete grids, this simulates linear interpolation between day N and N+1)
    const timeAccurateSic = getSicAt(wp.lat, wp.lon, forecastDayFloat);
    wp.iceConcentrationPct = Math.round(timeAccurateSic);

    const forecastConfidencePct = Math.max(90, Math.round(98 - (forecastDayFloat * 0.8)));

    results.push({
      waypointIndex: idx,
      timeHours,
      forecastDayFloat,
      originalSicPct,
      timeAccurateSicPct: wp.iceConcentrationPct,
      forecastConfidencePct
    });
  });

  // Recompute the average sea-ice concentration for the entire route
  route.averageIceConcentrationPct = Math.round(
    route.waypoints.reduce((acc, wp) => acc + wp.iceConcentrationPct, 0) / Math.max(1, route.waypoints.length)
  );

  return results;
}
