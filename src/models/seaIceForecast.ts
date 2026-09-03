import { DatasetMetadata } from '../data/types';

/**
 * Deterministic statistical/mock model for Sea Ice Concentration (SIC).
 * 
 * REAL MODEL REPLACEMENT:
 * A true integration would replace this with a spatiotemporal deep learning 
 * model (e.g. ConvLSTM or U-Net) that ingests historical AMSR2/Sentinel-1 grids, 
 * ERA5 atmospheric forcing, and ocean currents. It would output a temporal sequence
 * of SIC tensors predicting physical ice evolution over the forecast horizon.
 */

export function getSicAt(lat: number, lon: number, day: number): number {
  let iceConc = 0;
  // Use a base formula derived from the existing latitude-dependent gradient
  if (lat < -60) {
    iceConc = Math.min(95, Math.pow(Math.abs(lat + 60) / 11, 1.35) * 75);
  }
  // Ice grows as forecast day progresses
  if (day > 0) {
    iceConc += day * 2.5;
  }
  return Math.max(0, Math.min(100, iceConc));
}

export function getForecastGrid(day: number): { 
  grid: { lat: number; lon: number; sicPct: number }[]; 
  confidencePct: number; 
  metadata: DatasetMetadata 
} {
  // Confidence decreases from ~95% at day 0 to ~65% at day 7
  const confidencePct = Math.max(65, 95 - (day * (30 / 7)));
  
  // Generate a sparse grid for the Antarctic region
  const grid = [];
  for (let lat = -55; lat >= -80; lat -= 5) {
    for (let lon = -180; lon <= 180; lon += 30) {
      grid.push({
        lat,
        lon,
        sicPct: Math.round(getSicAt(lat, lon, day))
      });
    }
  }

  return {
    grid,
    confidencePct: Math.round(confidencePct),
    metadata: {
      source: 'PolarNav Mock AI Model (ConvLSTM Stand-in)',
      acquisitionTime: new Date().toISOString(),
      processingTime: new Date().toISOString(),
      geographicCoverage: 'Southern Ocean',
      spatialResolutionKm: 25,
      temporalResolutionHours: 24,
      status: 'MOCK'
    }
  };
}
