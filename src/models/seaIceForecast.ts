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
  
  // Organic, realistic Antarctic ice edge (varies between -48°S and -57°S depending on oceanic sector)
  const lonRad = (lon * Math.PI) / 180;
  const iceEdgeLat = -52.5 - Math.sin(lonRad * 2) * 3.5 - Math.cos(lonRad * 3) * 2.0;

  if (lat < iceEdgeLat) {
    const latDiff = Math.abs(lat - iceEdgeLat);
    // Smooth power curve reaching ~95% near continent margin
    iceConc = Math.min(96, Math.pow(latDiff / 17, 1.25) * 82);
  }

  // Ice grows as forecast day progresses
  if (day > 0) {
    iceConc += day * 2.2;
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
  for (let lat = -50; lat >= -80; lat -= 5) {
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
