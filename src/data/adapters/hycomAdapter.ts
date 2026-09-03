import { DataEnvelope } from '../types';

/*
 * This mock adapter simulates fetching HYCOM ocean current data.
 * Real Integration:
 * - Endpoint: HYCOM OPeNDAP Server / TDS
 * - Auth: Generally open / IP restricted
 * - Format: NetCDF via OPeNDAP
 */
export function fetchHycomOceanGrid(lat: number, lon: number, day: number): DataEnvelope<{ lat: number; lon: number; u_current: number; v_current: number }[]> {
  const seed = Math.abs(Math.cos(lat * 2 - lon * 3 + day));
  
  return {
    metadata: {
      source: 'HYCOM / GLORYS Oceanography',
      acquisitionTime: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
      processingTime: new Date().toISOString(),
      geographicCoverage: 'Global',
      spatialResolutionKm: 9, // ~1/12 deg
      temporalResolutionHours: 24,
      status: 'MOCK'
    },
    data: [
      { lat, lon, u_current: (seed - 0.5) * 2, v_current: ((seed * 1.7) % 1 - 0.5) * 2 }
    ]
  };
}
