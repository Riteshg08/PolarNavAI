import * as fs from 'fs';

function getDistanceLatLon(lat: number, lon: number, distanceNmi: number, headingDeg: number) {
  const headingRad = headingDeg * (Math.PI / 180);
  const dLat = (distanceNmi * Math.cos(headingRad)) / 60.0;
  const latRad = lat * (Math.PI / 180);
  const dLon = (distanceNmi * Math.sin(headingRad)) / (60.0 * Math.cos(latRad));
  return { lat: lat + dLat, lon: lon + dLon };
}

const icebergsInput = [
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
  },
  // Adding back the 6 extra icebergs
  {
    id: 'B09F_Blocker',
    name: 'Iceberg B-09F (McMurdo Sound)',
    lat: -76.2,
    lon: 165.5,
    lengthKm: 180,
    widthKm: 45,
    heightMeters: 400,
    driftSpeedKnots: 0.2,
    driftHeadingDeg: 0,
    hazardLevel: 'CRITICAL',
    lastObserved: '2026-09-03 10:00 UTC (US NIC)',
    source: 'US NIC',
  },
  {
    id: 'A76A',
    name: 'Iceberg A-76A (Drake Passage)',
    lat: -59.5,
    lon: -51.2,
    lengthKm: 135,
    widthKm: 26,
    heightMeters: 310,
    driftSpeedKnots: 1.8,
    driftHeadingDeg: 65,
    hazardLevel: 'HIGH',
    lastObserved: '2026-09-02 14:45 UTC (BYU Scatterometer)',
    source: 'BYU Scatterometer',
  },
  {
    id: 'C40',
    name: 'Iceberg C-40 (Amundsen Sea)',
    lat: -73.2,
    lon: -105.4,
    lengthKm: 25,
    widthKm: 15,
    heightMeters: 180,
    driftSpeedKnots: 0.5,
    driftHeadingDeg: 290,
    hazardLevel: 'MODERATE',
    lastObserved: '2026-09-01 08:00 UTC (Sentinel-1 SAR)',
    source: 'Sentinel-1 SAR',
  },
  {
    id: 'D45',
    name: 'Iceberg D-45 (Weddell Sea)',
    lat: -71.5,
    lon: -45.0,
    lengthKm: 42,
    widthKm: 22,
    heightMeters: 250,
    driftSpeedKnots: 0.8,
    driftHeadingDeg: 350,
    hazardLevel: 'CRITICAL',
    lastObserved: '2026-09-02 20:00 UTC (AMSR2 Radar)',
    source: 'US NIC',
  },
  {
    id: 'A82',
    name: 'Iceberg A-82 (Ross Sea)',
    lat: -74.8,
    lon: 172.5,
    lengthKm: 55,
    widthKm: 20,
    heightMeters: 290,
    driftSpeedKnots: 0.6,
    driftHeadingDeg: 320,
    hazardLevel: 'HIGH',
    lastObserved: '2026-09-03 04:00 UTC (BYU Scatterometer)',
    source: 'BYU Scatterometer',
  },
  {
    id: 'B10A',
    name: 'Iceberg B-10A (Bellingshausen Sea)',
    lat: -69.5,
    lon: -85.2,
    lengthKm: 30,
    widthKm: 12,
    heightMeters: 200,
    driftSpeedKnots: 1.0,
    driftHeadingDeg: 275,
    hazardLevel: 'MODERATE',
    lastObserved: '2026-09-02 16:00 UTC (Sentinel-1 SAR)',
    source: 'Sentinel-1 SAR',
  }
];

let output = `import { Iceberg } from '../types';

export const ICEBERGS: Iceberg[] = [\n`;

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
console.log('Successfully regenerated icebergs.ts with 15-day trajectories.');
