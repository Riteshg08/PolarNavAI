import * as fs from 'fs';

function getDistanceLatLon(lat: number, lon: number, distanceNmi: number, headingDeg: number) {
  const headingRad = headingDeg * (Math.PI / 180);
  const dLat = (distanceNmi * Math.cos(headingRad)) / 60.0;
  const latRad = lat * (Math.PI / 180);
  const dLon = (distanceNmi * Math.sin(headingRad)) / (60.0 * Math.cos(latRad));
  return { lat: lat + dLat, lon: lon + dLon };
}

const icebergsInput = [
  // ================ MEGA / LARGE ICEBERGS (rare, notable) ================
  {
    id: 'A23a',
    name: 'Iceberg A-23a (Mega)',
    lat: -60.8, lon: -44.5,
    lengthKm: 65, widthKm: 42, heightMeters: 380,
    driftSpeedKnots: 1.4, driftHeadingDeg: 48,
    hazardLevel: 'CRITICAL',
    lastObserved: '2026-09-02 18:00 UTC (Sentinel-1 SAR)', source: 'Sentinel-1 SAR',
  },
  {
    id: 'B15a',
    name: 'Iceberg B-15A (Large)',
    lat: -65.2, lon: 68.4,
    lengthKm: 28, widthKm: 14, heightMeters: 220,
    driftSpeedKnots: 0.9, driftHeadingDeg: 315,
    hazardLevel: 'HIGH',
    lastObserved: '2026-09-03 06:00 UTC (AMSR2)', source: 'US NIC',
  },
  {
    id: 'D30',
    name: 'Iceberg D-30 (Prydz Bay)',
    lat: -67.1, lon: 74.5,
    lengthKm: 18, widthKm: 9, heightMeters: 180,
    driftSpeedKnots: 1.1, driftHeadingDeg: 285,
    hazardLevel: 'CRITICAL',
    lastObserved: '2026-09-03 12:00 UTC (SAR)', source: 'BYU Scatterometer',
  },
  {
    id: 'C38',
    name: 'Iceberg C-38 (Maitri)',
    lat: -68.4, lon: 14.2,
    lengthKm: 12, widthKm: 7, heightMeters: 140,
    driftSpeedKnots: 0.7, driftHeadingDeg: 260,
    hazardLevel: 'MODERATE',
    lastObserved: '2026-09-02 22:00 UTC (AMSR2)', source: 'Sentinel-1 SAR',
  },

  // ================ MEDIUM ICEBERGS (10-20 km) ================
  { id: 'M1', name: 'Iceberg M-1 (Weddell)', lat: -62.5, lon: -38.0, lengthKm: 15, widthKm: 8, heightMeters: 120, driftSpeedKnots: 1.3, driftHeadingDeg: 55, hazardLevel: 'HIGH', lastObserved: '2026-09-04', source: 'SAR' },
  { id: 'M2', name: 'Iceberg M-2 (Enderby)', lat: -66.8, lon: 48.5, lengthKm: 14, widthKm: 6, heightMeters: 100, driftSpeedKnots: 0.9, driftHeadingDeg: 270, hazardLevel: 'HIGH', lastObserved: '2026-09-04', source: 'SAR' },
  { id: 'M3', name: 'Iceberg M-3 (Ross)', lat: -76.5, lon: 168.2, lengthKm: 16, widthKm: 7, heightMeters: 95, driftSpeedKnots: 0.3, driftHeadingDeg: 20, hazardLevel: 'HIGH', lastObserved: '2026-09-04', source: 'US NIC' },
  { id: 'M4', name: 'Iceberg M-4 (Kerguelen)', lat: -58.0, lon: 62.5, lengthKm: 11, widthKm: 5, heightMeters: 80, driftSpeedKnots: 1.5, driftHeadingDeg: 100, hazardLevel: 'MODERATE', lastObserved: '2026-09-04', source: 'SAR' },
  { id: 'M5', name: 'Iceberg M-5 (Amundsen)', lat: -73.2, lon: -105.4, lengthKm: 13, widthKm: 6, heightMeters: 110, driftSpeedKnots: 0.5, driftHeadingDeg: 290, hazardLevel: 'HIGH', lastObserved: '2026-09-04', source: 'US NIC' },

  // ================ SMALL ICEBERGS (2-10 km) ================
  // Cape Town → Maitri corridor (lon ~10-20)
  { id: 'S1', name: 'Frag S-1', lat: -55.2, lon: 18.5, lengthKm: 4.5, widthKm: 2.1, heightMeters: 30, driftSpeedKnots: 1.2, driftHeadingDeg: 80, hazardLevel: 'MODERATE', lastObserved: '2026-09-04', source: 'SAR' },
  { id: 'S2', name: 'Frag S-2', lat: -62.1, lon: 24.3, lengthKm: 6.2, widthKm: 3.0, heightMeters: 45, driftSpeedKnots: 0.8, driftHeadingDeg: 95, hazardLevel: 'LOW', lastObserved: '2026-09-04', source: 'SAR' },
  { id: 'S3', name: 'Frag S-3', lat: -64.8, lon: 35.1, lengthKm: 3.2, widthKm: 1.5, heightMeters: 25, driftSpeedKnots: 0.9, driftHeadingDeg: 110, hazardLevel: 'LOW', lastObserved: '2026-09-04', source: 'SAR' },
  { id: 'S4', name: 'Frag S-4', lat: -66.5, lon: 42.7, lengthKm: 8.5, widthKm: 4.2, heightMeters: 55, driftSpeedKnots: 1.1, driftHeadingDeg: 260, hazardLevel: 'MODERATE', lastObserved: '2026-09-04', source: 'SAR' },

  // Cape Town → Bharati corridor (lon ~40-80)
  { id: 'S5', name: 'Frag S-5', lat: -68.2, lon: 55.4, lengthKm: 2.8, widthKm: 1.1, heightMeters: 15, driftSpeedKnots: 0.5, driftHeadingDeg: 280, hazardLevel: 'LOW', lastObserved: '2026-09-04', source: 'SAR' },
  { id: 'S6', name: 'Frag S-6', lat: -69.0, lon: 65.9, lengthKm: 7.0, widthKm: 3.5, heightMeters: 50, driftSpeedKnots: 0.7, driftHeadingDeg: 300, hazardLevel: 'MODERATE', lastObserved: '2026-09-04', source: 'SAR' },
  { id: 'S7', name: 'Frag S-7', lat: -67.5, lon: 70.2, lengthKm: 5.5, widthKm: 2.5, heightMeters: 40, driftSpeedKnots: 1.0, driftHeadingDeg: 275, hazardLevel: 'MODERATE', lastObserved: '2026-09-04', source: 'SAR' },
  { id: 'S8', name: 'Frag S-8', lat: -68.8, lon: 77.1, lengthKm: 3.5, widthKm: 1.8, heightMeters: 28, driftSpeedKnots: 0.6, driftHeadingDeg: 250, hazardLevel: 'LOW', lastObserved: '2026-09-04', source: 'SAR' },

  // Prydz Bay area (lon ~75-90)
  { id: 'S9', name: 'Frag S-9', lat: -69.2, lon: 80.5, lengthKm: 7.2, widthKm: 3.5, heightMeters: 50, driftSpeedKnots: 0.4, driftHeadingDeg: 310, hazardLevel: 'MODERATE', lastObserved: '2026-09-04', source: 'SAR' },
  { id: 'S10', name: 'Frag S-10', lat: -67.9, lon: 85.0, lengthKm: 4.1, widthKm: 2.0, heightMeters: 35, driftSpeedKnots: 0.8, driftHeadingDeg: 330, hazardLevel: 'LOW', lastObserved: '2026-09-04', source: 'SAR' },

  // Southern Indian Ocean scattered
  { id: 'S11', name: 'Frag S-11', lat: -57.3, lon: 32.8, lengthKm: 3.8, widthKm: 1.9, heightMeters: 22, driftSpeedKnots: 1.4, driftHeadingDeg: 90, hazardLevel: 'LOW', lastObserved: '2026-09-04', source: 'SAR' },
  { id: 'S12', name: 'Frag S-12', lat: -60.5, lon: 50.2, lengthKm: 5.0, widthKm: 2.4, heightMeters: 38, driftSpeedKnots: 1.0, driftHeadingDeg: 120, hazardLevel: 'MODERATE', lastObserved: '2026-09-04', source: 'SAR' },
  { id: 'S13', name: 'Frag S-13', lat: -63.9, lon: 58.7, lengthKm: 6.8, widthKm: 3.2, heightMeters: 48, driftSpeedKnots: 0.6, driftHeadingDeg: 245, hazardLevel: 'MODERATE', lastObserved: '2026-09-04', source: 'SAR' },

  // Weddell Sea & Drake Passage
  { id: 'S14', name: 'Frag S-14', lat: -59.5, lon: -51.2, lengthKm: 7.5, widthKm: 4.0, heightMeters: 60, driftSpeedKnots: 1.8, driftHeadingDeg: 65, hazardLevel: 'MODERATE', lastObserved: '2026-09-04', source: 'SAR' },
  { id: 'S15', name: 'Frag S-15', lat: -63.0, lon: -30.5, lengthKm: 4.2, widthKm: 2.0, heightMeters: 32, driftSpeedKnots: 1.1, driftHeadingDeg: 50, hazardLevel: 'LOW', lastObserved: '2026-09-04', source: 'SAR' },
  { id: 'S16', name: 'Frag S-16', lat: -71.5, lon: -45.0, lengthKm: 5.8, widthKm: 3.2, heightMeters: 42, driftSpeedKnots: 0.8, driftHeadingDeg: 350, hazardLevel: 'LOW', lastObserved: '2026-09-04', source: 'SAR' },

  // Ross Sea & Pacific sector
  { id: 'S17', name: 'Frag S-17', lat: -74.2, lon: 175.5, lengthKm: 5.8, widthKm: 2.9, heightMeters: 45, driftSpeedKnots: 0.9, driftHeadingDeg: 45, hazardLevel: 'MODERATE', lastObserved: '2026-09-04', source: 'SAR' },
  { id: 'S18', name: 'Frag S-18', lat: -72.8, lon: -180.0, lengthKm: 2.5, widthKm: 1.2, heightMeters: 20, driftSpeedKnots: 1.1, driftHeadingDeg: 60, hazardLevel: 'LOW', lastObserved: '2026-09-04', source: 'SAR' },
  { id: 'S19', name: 'Frag S-19', lat: -70.5, lon: -170.5, lengthKm: 8.0, widthKm: 4.0, heightMeters: 60, driftSpeedKnots: 1.4, driftHeadingDeg: 85, hazardLevel: 'MODERATE', lastObserved: '2026-09-04', source: 'SAR' },

  // Additional new small icebergs along main corridors
  { id: 'S20', name: 'Frag S-20', lat: -53.8, lon: 25.4, lengthKm: 2.2, widthKm: 1.0, heightMeters: 18, driftSpeedKnots: 1.6, driftHeadingDeg: 85, hazardLevel: 'LOW', lastObserved: '2026-09-04', source: 'SAR' },
  { id: 'S21', name: 'Frag S-21', lat: -56.4, lon: 40.1, lengthKm: 3.5, widthKm: 1.6, heightMeters: 26, driftSpeedKnots: 1.3, driftHeadingDeg: 105, hazardLevel: 'LOW', lastObserved: '2026-09-04', source: 'SAR' },
  { id: 'S22', name: 'Frag S-22', lat: -61.7, lon: 15.3, lengthKm: 9.0, widthKm: 4.5, heightMeters: 65, driftSpeedKnots: 0.9, driftHeadingDeg: 240, hazardLevel: 'MODERATE', lastObserved: '2026-09-04', source: 'SAR' },
  { id: 'S23', name: 'Frag S-23', lat: -66.0, lon: 60.8, lengthKm: 4.8, widthKm: 2.3, heightMeters: 35, driftSpeedKnots: 0.7, driftHeadingDeg: 290, hazardLevel: 'LOW', lastObserved: '2026-09-04', source: 'SAR' },
  { id: 'S24', name: 'Frag S-24', lat: -64.2, lon: 72.5, lengthKm: 6.5, widthKm: 3.1, heightMeters: 42, driftSpeedKnots: 1.2, driftHeadingDeg: 310, hazardLevel: 'MODERATE', lastObserved: '2026-09-04', source: 'SAR' },
  { id: 'S25', name: 'Frag S-25', lat: -70.1, lon: 72.8, lengthKm: 3.0, widthKm: 1.4, heightMeters: 20, driftSpeedKnots: 0.5, driftHeadingDeg: 265, hazardLevel: 'LOW', lastObserved: '2026-09-04', source: 'SAR' },
];

let output = `import { Iceberg } from '../types';\n\nexport const ICEBERGS: Iceberg[] = [\n`;

icebergsInput.forEach((ib, idx) => {
  output += `  {
    id: '${ib.id}',
    name: '${ib.name}',
    lat: ${ib.lat},
    lon: ${ib.lon},
    lengthKm: ${ib.lengthKm},
    widthKm: ${ib.widthKm},
    heightMeters: ${ib.heightMeters},
    driftSpeedKnots: ${ib.driftSpeedKnots},
    driftHeadingDeg: ${ib.driftHeadingDeg},
    hazardLevel: '${ib.hazardLevel}',
    lastObserved: '${ib.lastObserved}',
    source: '${ib.source}',
    trajectory: [\n`;

  for (let day = 0; day <= 14; day++) {
    const distNmi = (ib.driftSpeedKnots * 24) * day;
    const pos = getDistanceLatLon(ib.lat, ib.lon, distNmi, ib.driftHeadingDeg);
    output += `      { day: ${day}, lat: ${pos.lat.toFixed(3)}, lon: ${pos.lon.toFixed(3)} }${day < 14 ? ',' : ''}\n`;
  }

  output += `    ]
  }${idx < icebergsInput.length - 1 ? ',' : ''}\n`;
});

output += `];\n`;

fs.writeFileSync('./src/data/icebergs.ts', output);
console.log(`Successfully regenerated icebergs.ts with ${icebergsInput.length} icebergs and 15-day trajectories.`);
