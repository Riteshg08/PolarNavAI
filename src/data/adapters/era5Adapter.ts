import { DataEnvelope } from '../types';

/*
 * This mock adapter simulates fetching ERA5 atmospheric reanalysis data.
 * Real Integration:
 * - Endpoint: ECMWF Climate Data Store (CDS) API
 * - Auth: API Key (CDS API token)
 * - Format: GRIB or NetCDF
 */
export function fetchERA5WindGrid(lat: number, lon: number, day: number): DataEnvelope<{ lat: number; lon: number; u_wind: number; v_wind: number }[]> {
  const seed = Math.abs(Math.sin(lat * 3 + lon - day));
  
  return {
    metadata: {
      source: 'ERA5 Atmospheric Reanalysis',
      acquisitionTime: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      processingTime: new Date().toISOString(),
      geographicCoverage: 'Global',
      spatialResolutionKm: 31, // ~0.25 deg
      temporalResolutionHours: 1,
      status: 'MOCK'
    },
    data: [
      { lat, lon, u_wind: (seed - 0.5) * 40, v_wind: ((seed * 1.3) % 1 - 0.5) * 40 }
    ]
  };
}
