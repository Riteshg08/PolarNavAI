import { StationLocation } from '../types';

// Station Presets
export const STATIONS: StationLocation[] = [
  { id: 'CAPE_TOWN', name: 'Cape Town Port', country: 'South Africa', lat: -33.92, lon: 18.42, type: 'Port of Origin' },
  { id: 'BHARATI', name: 'Bharati Station (Larsemann Hills)', country: 'India', lat: -69.41, lon: 76.19, type: 'Research Station' },
  { id: 'MAITRI', name: 'Maitri Station (Schirmacher Oasis)', country: 'India', lat: -70.76, lon: 11.73, type: 'Research Station' },
  { id: 'PRYDZ_BAY', name: 'Prydz Bay Anchorage', country: 'India/Global', lat: -68.80, lon: 75.00, type: 'Field Camp' },
  { id: 'MCMURDO', name: 'McMurdo Station', country: 'USA', lat: -77.85, lon: 166.67, type: 'Research Station' },
  { id: 'DAVIS', name: 'Davis Station', country: 'Australia', lat: -68.58, lon: 77.97, type: 'Research Station' }
];
