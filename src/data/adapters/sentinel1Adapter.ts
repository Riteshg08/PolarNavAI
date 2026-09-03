import { DataEnvelope } from '../types';

/*
 * This mock adapter simulates fetching Sentinel-1 SAR (Synthetic Aperture Radar) data.
 * Real Integration:
 * - Endpoint: Copernicus Open Access Hub / OData API
 * - Auth: OAuth2 / Bearer Token
 * - Format: GeoTIFF or NetCDF converted to JSON arrays on backend
 */
export function fetchSentinel1IceObservations(lat: number, lon: number, day: number): DataEnvelope<{ lat: number; lon: number; concentration: number }[]> {
  // Deterministic mock generation based on inputs
  const seed = Math.abs(Math.sin(lat + lon * 2 + day * 3));
  
  return {
    metadata: {
      source: 'Sentinel-1 C-Band SAR',
      acquisitionTime: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      processingTime: new Date().toISOString(),
      geographicCoverage: 'Southern Ocean (Sector)',
      spatialResolutionKm: 0.04, // 40m
      temporalResolutionHours: 24,
      status: 'MOCK'
    },
    data: [
      { lat, lon, concentration: Math.floor(seed * 100) },
      { lat: lat + 0.1, lon: lon + 0.1, concentration: Math.floor((seed * 1.5) % 1 * 100) }
    ]
  };
}
