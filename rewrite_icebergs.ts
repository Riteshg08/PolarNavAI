import * as fs from 'fs';

// A simpler way: just read the current icebergs.ts string, and for each iceberg definition, we'll replace the trajectory arrays.
// Actually, since I can just import it (after fixing the TS error in index.ts), let's just write a script that imports it.
// Oh wait, `icebergs.ts` currently fails to compile because `trajectory` is missing!
// Let me just write a regex script.

const rawData = fs.readFileSync('./src/data/icebergs.ts', 'utf-8');

const icebergRegex = /lat:\s*(-?\d+\.\d+),\s*lon:\s*(-?\d+\.\d+),[\s\S]*?driftSpeedKnots:\s*(\d+\.\d+),[\s\S]*?driftHeadingDeg:\s*(\d+),[\s\S]*?(trajectory7Day:[\s\S]*?](?:,\s*predictedTrajectory:[\s\S]*?])?)/g;

function getDistanceLatLon(lat: number, lon: number, distanceNmi: number, headingDeg: number) {
  const headingRad = headingDeg * (Math.PI / 180);
  const dLat = (distanceNmi * Math.cos(headingRad)) / 60.0;
  const latRad = lat * (Math.PI / 180);
  const dLon = (distanceNmi * Math.sin(headingRad)) / (60.0 * Math.cos(latRad));
  return { lat: lat + dLat, lon: lon + dLon };
}

const newData = rawData.replace(icebergRegex, (match, latStr, lonStr, speedStr, headingStr, oldTrajStr) => {
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);
    const speed = parseFloat(speedStr);
    const heading = parseFloat(headingStr);
    
    let trajLines = [];
    for (let day = 0; day <= 14; day++) {
        const distNmi = (speed * 24) * day;
        const pos = getDistanceLatLon(lat, lon, distNmi, heading);
        trajLines.push(`      { day: ${day}, lat: ${pos.lat.toFixed(3)}, lon: ${pos.lon.toFixed(3)} }`);
    }
    const newTrajStr = `trajectory: [\n${trajLines.join(',\n')}\n    ]`;
    
    return match.replace(oldTrajStr, newTrajStr);
});

fs.writeFileSync('./src/data/icebergs.ts', newData);
console.log('Done rewriting icebergs.ts');
