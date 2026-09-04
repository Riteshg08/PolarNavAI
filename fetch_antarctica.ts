import fs from 'fs';
import https from 'https';

const url = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries/ATA.geo.json';

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const geojson = JSON.parse(data);
      // ATA.geo.json is a Feature with MultiPolygon
      const coords = geojson.features[0].geometry.coordinates;
      
      // Find the largest polygon (main continent)
      let maxPoly = coords[0][0];
      for (const poly of coords) {
        if (poly[0].length > maxPoly.length) {
          maxPoly = poly[0];
        }
      }

      // maxPoly is an array of [lon, lat]
      // Let's downsample it to ~400 points
      const targetPoints = 400;
      const step = Math.max(1, Math.floor(maxPoly.length / targetPoints));
      
      const downsampled = [];
      for (let i = 0; i < maxPoly.length; i += step) {
        downsampled.push({ lat: maxPoly[i][1], lon: maxPoly[i][0] });
      }
      
      // Close the loop if needed
      if (downsampled.length > 0) {
          const first = downsampled[0];
          const last = downsampled[downsampled.length - 1];
          if (first.lat !== last.lat || first.lon !== last.lon) {
              downsampled.push({ lat: first.lat, lon: first.lon });
          }
      }

      // Format as string
      let pointsStr = 'const antarcticPoints = [\n';
      downsampled.forEach((pt, i) => {
        pointsStr += `      { lat: ${pt.lat.toFixed(3)}, lon: ${pt.lon.toFixed(3)} }${i < downsampled.length - 1 ? ',' : ''}\n`;
      });
      pointsStr += '    ];';

      // Read PolarMapCanvas.tsx
      const canvasPath = './src/components/PolarMapCanvas.tsx';
      let canvasCode = fs.readFileSync(canvasPath, 'utf-8');
      
      // Replace the old array
      const regex = /const antarcticPoints = \[\s*\{ lat: -63\.3[\s\S]*?\];/;
      if (regex.test(canvasCode)) {
          canvasCode = canvasCode.replace(regex, pointsStr);
          fs.writeFileSync(canvasPath, canvasCode);
          console.log(`Successfully updated PolarMapCanvas.tsx with ${downsampled.length} high-res points!`);
      } else {
          console.log('Regex failed to match the existing array.');
      }
      
    } catch (e) {
      console.error(e);
    }
  });
}).on('error', (e) => {
  console.error(e);
});
