import { Iceberg } from '../../types';

// Monster Icebergs in Southern Ocean
export const ICEBERGS: Iceberg[] = [
  {
    id: 'A23a',
    name: 'Iceberg A-23a (Mega Iceberg)',
    lat: -60.8,
    lon: -44.5,
    lengthKm: 65,
    widthKm: 42,
    heightMeters: 380,
    driftSpeedKnots: 1.4,
    driftHeadingDeg: 48,
    hazardLevel: 'CRITICAL',
    lastObserved: '2026-09-02 18:00 UTC (Sentinel-1 SAR)',
    source: 'Sentinel-1 SAR',
    trajectory7Day: [
      { day: 0, lat: -60.8, lon: -44.5 },
      { day: 1, lat: -60.4, lon: -43.8 },
      { day: 2, lat: -60.0, lon: -43.0 },
      { day: 3, lat: -59.5, lon: -42.1 },
      { day: 4, lat: -59.1, lon: -41.0 },
      { day: 5, lat: -58.6, lon: -39.8 },
      { day: 6, lat: -58.1, lon: -38.5 },
      { day: 7, lat: -57.5, lon: -37.0 }
    ]
  },
  {
    id: 'B15a_remnant',
    name: 'Iceberg B-15A (Drifting Fragment)',
    lat: -65.2,
    lon: 68.4,
    lengthKm: 28,
    widthKm: 14,
    heightMeters: 220,
    driftSpeedKnots: 0.9,
    driftHeadingDeg: 315,
    hazardLevel: 'HIGH',
    lastObserved: '2026-09-03 06:00 UTC (AMSR2 Radar)',
    source: 'US NIC',
    trajectory7Day: [
      { day: 0, lat: -65.2, lon: 68.4 },
      { day: 1, lat: -65.0, lon: 67.8 },
      { day: 2, lat: -64.7, lon: 67.1 },
      { day: 3, lat: -64.4, lon: 66.5 },
      { day: 4, lat: -64.1, lon: 65.8 },
      { day: 5, lat: -63.8, lon: 65.2 },
      { day: 6, lat: -63.5, lon: 64.5 },
      { day: 7, lat: -63.2, lon: 63.8 }
    ]
  },
  {
    id: 'D30',
    name: 'Iceberg D-30 (Prydz Bay Sector)',
    lat: -67.1,
    lon: 74.5,
    lengthKm: 18,
    widthKm: 9,
    heightMeters: 180,
    driftSpeedKnots: 1.1,
    driftHeadingDeg: 285,
    hazardLevel: 'CRITICAL',
    lastObserved: '2026-09-03 12:00 UTC (Sentinel-1 SAR)',
    source: 'BYU Scatterometer',
    trajectory7Day: [
      { day: 0, lat: -67.1, lon: 74.5 },
      { day: 1, lat: -67.0, lon: 73.6 },
      { day: 2, lat: -66.9, lon: 72.7 },
      { day: 3, lat: -66.8, lon: 71.8 },
      { day: 4, lat: -66.7, lon: 70.8 },
      { day: 5, lat: -66.6, lon: 69.9 },
      { day: 6, lat: -66.5, lon: 68.9 },
      { day: 7, lat: -66.4, lon: 67.9 }
    ]
  },
  {
    id: 'C38',
    name: 'Iceberg C-38 (Maitri Sector)',
    lat: -68.4,
    lon: 14.2,
    lengthKm: 12,
    widthKm: 7,
    heightMeters: 140,
    driftSpeedKnots: 0.7,
    driftHeadingDeg: 260,
    hazardLevel: 'MODERATE',
    lastObserved: '2026-09-02 22:00 UTC (AMSR2 Radar)',
    source: 'Sentinel-1 SAR',
    trajectory7Day: [
      { day: 0, lat: -68.4, lon: 14.2 },
      { day: 1, lat: -68.3, lon: 13.5 },
      { day: 2, lat: -68.3, lon: 12.8 },
      { day: 3, lat: -68.2, lon: 12.0 },
      { day: 4, lat: -68.1, lon: 11.2 },
      { day: 5, lat: -68.0, lon: 10.4 },
      { day: 6, lat: -67.9, lon: 9.6 },
      { day: 7, lat: -67.8, lon: 8.8 }
    ]
  }
];
