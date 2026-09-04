/**
 * Script to extend all iceberg trajectories from 14 days to 21 days.
 * Also redesigns key icebergs (B15a, D30, C38) for dramatic corridor blocking events.
 * 
 * Run: node extend_icebergs.js
 */

const fs = require('fs');
const path = require('path');

const icebergsPath = path.join(__dirname, 'src', 'data', 'icebergs.ts');
const content = fs.readFileSync(icebergsPath, 'utf8');

function extrapolateTrajectory(trajectory, targetDays) {
  if (trajectory.length < 2) return trajectory;
  const result = [...trajectory];
  const lastDay = result[result.length - 1].day;
  if (lastDay >= targetDays) return result;
  
  const n = Math.min(3, result.length - 1);
  let avgDLat = 0, avgDLon = 0;
  for (let i = result.length - n; i < result.length; i++) {
    avgDLat += result[i].lat - result[i-1].lat;
    avgDLon += result[i].lon - result[i-1].lon;
  }
  avgDLat /= n;
  avgDLon /= n;
  
  for (let day = lastDay + 1; day <= targetDays; day++) {
    const prev = result[result.length - 1];
    result.push({
      day,
      lat: parseFloat((prev.lat + avgDLat).toFixed(3)),
      lon: parseFloat((prev.lon + avgDLon).toFixed(3))
    });
  }
  return result;
}

const REDESIGNED = {
  'B15a': [
    { day: 0, lat: -63.500, lon: 56.000 },
    { day: 1, lat: -63.200, lon: 57.500 },
    { day: 2, lat: -62.800, lon: 59.200 },
    { day: 3, lat: -62.200, lon: 60.500 },
    { day: 4, lat: -61.800, lon: 61.500 },
    { day: 5, lat: -61.500, lon: 62.800 },
    { day: 6, lat: -61.300, lon: 64.000 },
    { day: 7, lat: -61.200, lon: 65.500 },
    { day: 8, lat: -61.100, lon: 67.000 },
    { day: 9, lat: -61.000, lon: 68.200 },
    { day: 10, lat: -61.000, lon: 69.500 },
    { day: 11, lat: -61.100, lon: 70.500 },
    { day: 12, lat: -61.200, lon: 71.500 },
    { day: 13, lat: -61.300, lon: 72.500 },
    { day: 14, lat: -61.400, lon: 73.500 },
    { day: 15, lat: -61.500, lon: 74.500 },
    { day: 16, lat: -61.600, lon: 75.200 },
    { day: 17, lat: -61.700, lon: 76.000 },
    { day: 18, lat: -61.800, lon: 76.800 },
    { day: 19, lat: -61.900, lon: 77.500 },
    { day: 20, lat: -62.000, lon: 78.200 },
    { day: 21, lat: -62.100, lon: 79.000 }
  ],
  'D30': [
    { day: 0, lat: -67.500, lon: 72.000 },
    { day: 1, lat: -67.600, lon: 72.800 },
    { day: 2, lat: -67.800, lon: 73.500 },
    { day: 3, lat: -68.000, lon: 74.200 },
    { day: 4, lat: -68.200, lon: 74.800 },
    { day: 5, lat: -68.400, lon: 75.500 },
    { day: 6, lat: -68.600, lon: 76.000 },
    { day: 7, lat: -68.800, lon: 76.400 },
    { day: 8, lat: -69.000, lon: 76.800 },
    { day: 9, lat: -69.200, lon: 77.200 },
    { day: 10, lat: -69.400, lon: 77.800 },
    { day: 11, lat: -69.600, lon: 78.500 },
    { day: 12, lat: -69.800, lon: 79.200 },
    { day: 13, lat: -70.000, lon: 80.000 },
    { day: 14, lat: -70.200, lon: 80.800 },
    { day: 15, lat: -70.400, lon: 81.500 },
    { day: 16, lat: -70.600, lon: 82.200 },
    { day: 17, lat: -70.800, lon: 83.000 },
    { day: 18, lat: -71.000, lon: 83.700 },
    { day: 19, lat: -71.200, lon: 84.400 },
    { day: 20, lat: -71.400, lon: 85.200 },
    { day: 21, lat: -71.600, lon: 86.000 }
  ],
  'C38': [
    { day: 0, lat: -69.500, lon: 45.000 },
    { day: 1, lat: -69.200, lon: 43.500 },
    { day: 2, lat: -68.900, lon: 42.000 },
    { day: 3, lat: -68.600, lon: 40.500 },
    { day: 4, lat: -68.300, lon: 39.000 },
    { day: 5, lat: -68.000, lon: 37.500 },
    { day: 6, lat: -67.700, lon: 36.000 },
    { day: 7, lat: -67.400, lon: 34.500 },
    { day: 8, lat: -67.100, lon: 33.000 },
    { day: 9, lat: -66.800, lon: 31.500 },
    { day: 10, lat: -66.500, lon: 30.000 },
    { day: 11, lat: -66.200, lon: 28.500 },
    { day: 12, lat: -66.000, lon: 27.000 },
    { day: 13, lat: -65.800, lon: 25.500 },
    { day: 14, lat: -65.600, lon: 24.000 },
    { day: 15, lat: -65.400, lon: 22.500 },
    { day: 16, lat: -65.200, lon: 21.000 },
    { day: 17, lat: -65.000, lon: 19.500 },
    { day: 18, lat: -64.800, lon: 18.000 },
    { day: 19, lat: -64.600, lon: 16.500 },
    { day: 20, lat: -64.400, lon: 15.000 },
    { day: 21, lat: -64.200, lon: 13.500 }
  ],
  'M2': [
    { day: 0, lat: -68.000, lon: 52.000 },
    { day: 1, lat: -67.600, lon: 53.200 },
    { day: 2, lat: -67.200, lon: 54.500 },
    { day: 3, lat: -66.800, lon: 55.800 },
    { day: 4, lat: -66.400, lon: 57.000 },
    { day: 5, lat: -66.000, lon: 58.200 },
    { day: 6, lat: -65.600, lon: 59.500 },
    { day: 7, lat: -65.200, lon: 60.800 },
    { day: 8, lat: -64.800, lon: 62.000 },
    { day: 9, lat: -64.400, lon: 63.200 },
    { day: 10, lat: -64.000, lon: 64.500 },
    { day: 11, lat: -63.700, lon: 65.500 },
    { day: 12, lat: -63.400, lon: 66.500 },
    { day: 13, lat: -63.100, lon: 67.500 },
    { day: 14, lat: -62.800, lon: 68.500 },
    { day: 15, lat: -62.500, lon: 69.500 },
    { day: 16, lat: -62.200, lon: 70.500 },
    { day: 17, lat: -62.000, lon: 71.500 },
    { day: 18, lat: -61.800, lon: 72.500 },
    { day: 19, lat: -61.600, lon: 73.500 },
    { day: 20, lat: -61.400, lon: 74.500 },
    { day: 21, lat: -61.200, lon: 75.500 }
  ]
};

function processFile(content) {
  const icebergRegex = /id:\s*'(\w+)',/g;
  const icebergIds = [];
  let match;
  while ((match = icebergRegex.exec(content)) !== null) {
    icebergIds.push({ id: match[1], pos: match.index });
  }
  
  const trajectoryMatches = [];
  const trajectoryRegex = /trajectory:\s*\[([^\]]*)\]/gs;
  while ((match = trajectoryRegex.exec(content)) !== null) {
    trajectoryMatches.push({
      fullMatch: match[0],
      content: match[1],
      start: match.index,
      end: match.index + match[0].length
    });
  }
  
  let result = content;
  
  for (let i = trajectoryMatches.length - 1; i >= 0; i--) {
    const trajMatch = trajectoryMatches[i];
    let icebergId = null;
    for (let j = icebergIds.length - 1; j >= 0; j--) {
      if (icebergIds[j].pos < trajMatch.start) {
        icebergId = icebergIds[j].id;
        break;
      }
    }
    if (!icebergId) continue;
    
    if (REDESIGNED[icebergId]) {
      const newTraj = REDESIGNED[icebergId];
      const newTrajStr = newTraj.map(p => 
        `      { day: ${p.day}, lat: ${p.lat.toFixed(3)}, lon: ${p.lon.toFixed(3)} }`
      ).join(',\n');
      const replacement = `trajectory: [\n${newTrajStr}\n    ]`;
      result = result.substring(0, trajMatch.start) + replacement + result.substring(trajMatch.end);
    } else {
      const dayRegex = /\{\s*day:\s*(\d+),\s*lat:\s*([-\d.]+),\s*lon:\s*([-\d.]+)\s*\}/g;
      const points = [];
      let m;
      while ((m = dayRegex.exec(trajMatch.content)) !== null) {
        points.push({
          day: parseInt(m[1]),
          lat: parseFloat(m[2]),
          lon: parseFloat(m[3])
        });
      }
      if (points.length < 2) continue;
      
      const extended = extrapolateTrajectory(points, 21);
      const newTrajStr = extended.map(p =>
        `      { day: ${p.day}, lat: ${p.lat.toFixed(3)}, lon: ${p.lon.toFixed(3)} }`
      ).join(',\n');
      const replacement = `trajectory: [\n${newTrajStr}\n    ]`;
      result = result.substring(0, trajMatch.start) + replacement + result.substring(trajMatch.end);
    }
  }
  return result;
}

const output = processFile(content);
fs.writeFileSync(icebergsPath, output, 'utf8');
console.log('Done! Extended all 34 iceberg trajectories to 21 days.');
console.log('Redesigned B15a, D30, C38, M2 for dramatic corridor blocking.');
