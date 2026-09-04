import { Iceberg } from '../types';

export const MAX_FORECAST_DAYS = 21;
import { simulateIcebergDriftRK4 } from '../utils/polarPhysics';
import { fetchERA5WindGrid } from '../data/adapters/era5Adapter';
import { fetchHycomOceanGrid } from '../data/adapters/hycomAdapter';

/**
 * Predicts the trajectory of an iceberg using rule-based hydrodynamic physics.
 * 
 * REAL MODEL REPLACEMENT:
 * A true integration would replace this rule-based ODE solver with a Physics-Informed 
 * Neural Network (PINN). The PINN would natively ingest ERA5/HYCOM tensors and 
 * historical SAR tracks, predicting non-linear drift and calving events directly,
 * rather than relying on strict parameterized drag coefficients.
 */
export function predictTrajectory(
  iceberg: Iceberg, 
  forecastDays: number
): { day: number; lat: number; lon: number; uncertaintyRadiusKm: number }[] {
  const trajectory = [];
  let currentLat = iceberg.lat;
  let currentLon = iceberg.lon;

  trajectory.push({
    day: 0,
    lat: currentLat,
    lon: currentLon,
    uncertaintyRadiusKm: 0 // No uncertainty at time of observation
  });

  for (let day = 1; day <= forecastDays; day++) {
    // Fetch mock environmental data for the current day and position
    const windData = fetchERA5WindGrid(currentLat, currentLon, day).data[0];
    const oceanData = fetchHycomOceanGrid(currentLat, currentLon, day).data[0];

    // Convert u/v vectors to speed (knots) and direction (degrees)
    // 1 m/s is approximately 1.94384 knots
    const windSpeedKnots = Math.sqrt(windData.u_wind ** 2 + windData.v_wind ** 2) * 1.94384;
    const windDirDeg = (Math.atan2(windData.u_wind, windData.v_wind) * 180) / Math.PI;

    const oceanSpeedKnots = Math.sqrt(oceanData.u_current ** 2 + oceanData.v_current ** 2) * 1.94384;
    const oceanDirDeg = (Math.atan2(oceanData.u_current, oceanData.v_current) * 180) / Math.PI;

    // Run RK4 physics step for 24 hours
    const nextPos = simulateIcebergDriftRK4(
      { ...iceberg, lat: currentLat, lon: currentLon },
      windSpeedKnots,
      windDirDeg,
      oceanSpeedKnots,
      oceanDirDeg,
      24
    );

    currentLat = nextPos.lat;
    currentLon = nextPos.lon;

    // Uncertainty grows non-linearly (sqrt of time) as model errors compound over the forecast horizon
    // E.g., Day 1: ~4.5km, Day 4: ~9km, Day 7: ~11.9km
    const uncertaintyRadiusKm = Math.sqrt(day) * 4.5; 

    trajectory.push({
      day,
      lat: currentLat,
      lon: currentLon,
      uncertaintyRadiusKm
    });
  }

  return trajectory;
}
