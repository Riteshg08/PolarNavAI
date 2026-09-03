import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RouteOption, Iceberg, StationLocation } from '../types';
import { STATIONS } from '../data/stations';
import { ICEBERGS } from '../data/icebergs';
import { getSicAt } from '../models/seaIceForecast';
import { Compass, Layers, ShieldAlert, Navigation, ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface PolarMapCanvasProps {
  routes: RouteOption[];
  icebergs: Iceberg[];
  activeRouteId: string;
  selectedIceberg: Iceberg | null;
  onSelectIceberg: (iceberg: Iceberg | null) => void;
  forecastDay: number;
  showIcebergs: boolean;
  showHeatmap: boolean;
  showVectors: boolean;
}

const R_FACTOR = 7.5;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5.0;

function latLonToCanvas(lat: number, lon: number, width: number, height: number, viewport: { centerLat: number, centerLon: number, zoom: number }) {
  const r = (90 + lat) * viewport.zoom * R_FACTOR;
  const theta = ((lon - viewport.centerLon) * Math.PI) / 180;
  
  const xUntranslated = r * Math.sin(theta);
  const yUntranslated = -r * Math.cos(theta); 
  
  const rCenter = (90 + viewport.centerLat) * viewport.zoom * R_FACTOR;
  
  const x = (width / 2) + xUntranslated;
  const y = (height / 2) + (yUntranslated - (-rCenter));
  
  return { x, y };
}

function canvasToLatLon(x: number, y: number, width: number, height: number, viewport: { centerLat: number, centerLon: number, zoom: number }) {
  const rCenter = (90 + viewport.centerLat) * viewport.zoom * R_FACTOR;
  
  const xUntranslated = x - (width / 2);
  const yUntranslated = y - (height / 2) - rCenter;
  
  const r = Math.sqrt(xUntranslated**2 + yUntranslated**2);
  const theta = Math.atan2(xUntranslated, -yUntranslated);
  
  const lat = r / (viewport.zoom * R_FACTOR) - 90;
  const lon = (theta * 180 / Math.PI) + viewport.centerLon;
  
  return { lat, lon };
}

function computeFitViewport(points: {lat: number; lon: number}[], width: number, height: number, paddingPx: number) {
  if (points.length === 0) return { centerLat: -65, centerLon: 45, zoom: 1.4 };
  
  let minLat = 90, maxLat = -90;
  let sumLonX = 0, sumLonY = 0;
  
  points.forEach(p => {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    const rad = (p.lon * Math.PI) / 180;
    sumLonX += Math.cos(rad);
    sumLonY += Math.sin(rad);
  });
  
  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (Math.atan2(sumLonY, sumLonX) * 180) / Math.PI;
  
  let bestZoom = MIN_ZOOM;
  let low = MIN_ZOOM, high = MAX_ZOOM;
  
  for (let i = 0; i < 15; i++) {
    const midZoom = (low + high) / 2;
    let fits = true;
    
    for (const p of points) {
      const { x, y } = latLonToCanvas(p.lat, p.lon, width, height, { centerLat, centerLon, zoom: midZoom });
      if (x < paddingPx || x > width - paddingPx || y < paddingPx || y > height - paddingPx) {
        fits = false;
        break;
      }
    }
    
    if (fits) {
      bestZoom = midZoom;
      low = midZoom; 
    } else {
      high = midZoom;
    }
  }
  
  return { centerLat, centerLon, zoom: bestZoom };
}

export const PolarMapCanvas: React.FC<PolarMapCanvasProps> = ({
  routes,
  icebergs,
  activeRouteId,
  selectedIceberg,
  onSelectIceberg,
  forecastDay,
  showIcebergs,
  showHeatmap,
  showVectors
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  const [vesselProgress, setVesselProgress] = useState<number>(0.25);
  const [dimensions, setDimensions] = useState({ width: 900, height: 650 });
  const [viewport, setViewport] = useState({ centerLat: -65.0, centerLon: 45.0, zoom: 1.4 });
  const [hasManualOverride, setHasManualOverride] = useState(false);
  
  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPixelRef = useRef({ x: 0, y: 0 });
  const dragStartViewportRef = useRef(viewport);

  // Resize Listener
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeRoute = routes.find((r) => r.id === activeRouteId) || routes[0];

  const fitToActiveRoute = useCallback(() => {
    if (!activeRoute || dimensions.width === 0 || dimensions.height === 0) return;
    
    const points: {lat: number; lon: number}[] = [];
    activeRoute.waypoints.forEach(wp => points.push({ lat: wp.lat, lon: wp.lon }));
    
    // Add icebergs that are relatively close to the route
    icebergs.forEach(berg => {
        const dist = Math.sqrt(Math.pow(berg.lat - points[0].lat, 2) + Math.pow(berg.lon - points[0].lon, 2));
        if (dist < 20) { // arbitrary proximity
            points.push({ lat: berg.lat, lon: berg.lon });
        }
    });

    const newViewport = computeFitViewport(points, dimensions.width, dimensions.height, 60);
    setViewport(newViewport);
    setHasManualOverride(false);
  }, [activeRoute, dimensions, icebergs]);

  // Auto-fit on route change if no manual override
  useEffect(() => {
    if (!hasManualOverride) {
      fitToActiveRoute();
    }
  }, [activeRouteId, routes, dimensions.width, dimensions.height, hasManualOverride, fitToActiveRoute]);

  // Animation Loop for Sailing Vessel
  useEffect(() => {
    const interval = setInterval(() => {
      setVesselProgress((prev) => (prev >= 1 ? 0 : prev + 0.003));
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Main Canvas Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const { width, height } = dimensions;

    // Clear canvas
    ctx.fillStyle = '#030814';
    ctx.fillRect(0, 0, width, height);

    const labelsToDraw: { text: string, tx: number, ty: number, color: string, font: string }[] = [];

    // 1. Draw Polar Grid Rings (-40°, -50°, -60°, -70°, -80°)
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.08)';
    ctx.lineWidth = 1;
    [-40, -50, -60, -70, -80].forEach((lat) => {
      const center = latLonToCanvas(lat, viewport.centerLon, width, height, viewport);
      const r = (90 + lat) * viewport.zoom * R_FACTOR;
      ctx.beginPath();
      ctx.arc(center.x, center.y, r, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.fillStyle = 'rgba(139, 155, 180, 0.4)';
      ctx.font = '10px JetBrains Mono';
      // Approximate label position
      ctx.fillText(`${lat}° S`, center.x + 6, center.y - r + 12);
    });

    // Pre-calculate continent path to use for both land masking and drawing
    const antarcticPoints = [
      { lat: -68.0, lon: -10 },
      { lat: -70.76, lon: 11.73 }, // Maitri
      { lat: -69.0, lon: 40.0 },
      { lat: -69.41, lon: 76.19 }, // Bharati
      { lat: -67.0, lon: 100.0 },
      { lat: -66.0, lon: 140.0 },
      { lat: -77.85, lon: 166.67 }, // McMurdo
      { lat: -82.0, lon: -170.0 },
      { lat: -75.0, lon: -110.0 },
      { lat: -65.0, lon: -65.0 }, // Antarctic Peninsula
      { lat: -75.0, lon: -40.0 }
    ];

    const continentPath = new Path2D();
    antarcticPoints.forEach((pt, idx) => {
      const { x, y } = latLonToCanvas(pt.lat, pt.lon, width, height, viewport);
      if (idx === 0) continentPath.moveTo(x, y);
      else continentPath.lineTo(x, y);
    });
    continentPath.closePath();

    // 2. Draw Sea Ice Heatmap Layer (Geographic Grid)
    if (showHeatmap) {
      const confidenceAlpha = Math.max(0.3, (95 - (forecastDay * (30 / 7))) / 100);

      // Grid bounds: covers typical Southern Ocean/Antarctic coastline
      const latStep = 1.5;
      const lonStep = 3.0;

      for (let lat = -50; lat >= -80; lat -= latStep) {
        for (let lon = -180; lon <= 180; lon += lonStep) {
          // Check if cell is over land, skip if so
          const center = latLonToCanvas(lat, lon, width, height, viewport);
          if (ctx.isPointInPath(continentPath, center.x, center.y)) continue;

          const sic = getSicAt(lat, lon, forecastDay);
          
          if (sic < 20) continue; // Skip open water

          let fillColor = '';
          if (sic >= 90) {
            fillColor = `rgba(255, 255, 255, ${0.85 * confidenceAlpha})`; // Fast Ice / Ice Shelf
          } else if (sic >= 60) {
            fillColor = `rgba(0, 242, 254, ${0.45 * confidenceAlpha})`;   // Heavy Pack Ice
          } else if (sic >= 40) {
            fillColor = `rgba(79, 172, 254, ${0.30 * confidenceAlpha})`;  // Marginal Ice Zone
          } else { // 20-40%
            fillColor = `rgba(79, 172, 254, ${0.15 * confidenceAlpha})`;  // Sparse Ice
          }

          // Project 4 corners (slightly expanded by 0.1 deg to avoid checkerboard gaps)
          const p1 = latLonToCanvas(lat + latStep / 2 + 0.1, lon - lonStep / 2 - 0.1, width, height, viewport);
          const p2 = latLonToCanvas(lat + latStep / 2 + 0.1, lon + lonStep / 2 + 0.1, width, height, viewport);
          const p3 = latLonToCanvas(lat - latStep / 2 - 0.1, lon + lonStep / 2 + 0.1, width, height, viewport);
          const p4 = latLonToCanvas(lat - latStep / 2 - 0.1, lon - lonStep / 2 - 0.1, width, height, viewport);

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.lineTo(p4.x, p4.y);
          ctx.closePath();
          
          ctx.fillStyle = fillColor;
          ctx.fill();
        }
      }
    }

    // 3. Draw Simplified Antarctic Continent Silhouette
    ctx.fillStyle = 'rgba(15, 32, 58, 0.85)';
    ctx.fill(continentPath);
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke(continentPath);

    // 4. Draw Navigation Routes
    routes.forEach((route) => {
      const isSelected = route.id === activeRouteId;
      ctx.beginPath();
      route.waypoints.forEach((wp, idx) => {
        const { x, y } = latLonToCanvas(wp.lat, wp.lon, width, height, viewport);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });

      if (route.id === 'OPTIMAL_AI') {
        ctx.strokeStyle = isSelected ? '#00f2fe' : 'rgba(0, 242, 254, 0.4)';
        ctx.lineWidth = isSelected ? 3.5 : 2;
        ctx.shadowColor = '#00f2fe';
        ctx.shadowBlur = isSelected ? 12 : 0;
      } else if (route.id === 'SHORTEST_DISTANCE') {
        ctx.strokeStyle = isSelected ? '#ff4b5c' : 'rgba(255, 75, 92, 0.35)';
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.setLineDash([6, 6]);
      } else {
        ctx.strokeStyle = isSelected ? '#ffb703' : 'rgba(255, 183, 3, 0.35)';
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.setLineDash([3, 3]);
      }

      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      if (isSelected) {
        route.waypoints.forEach((wp) => {
          if (wp.isWaypoint) {
            const { x, y } = latLonToCanvas(wp.lat, wp.lon, width, height, viewport);
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = '#00f2fe';
            ctx.fill();
            ctx.strokeStyle = '#050b14';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        });
      }
    });

    // 5. Draw Sailing Vessel Icon on Active Route
    if (activeRoute && activeRoute.waypoints.length > 1) {
      const idxFloat = vesselProgress * (activeRoute.waypoints.length - 1);
      const currIdx = Math.floor(idxFloat);
      const nextIdx = Math.min(currIdx + 1, activeRoute.waypoints.length - 1);
      const subT = idxFloat - currIdx;

      const wp1 = activeRoute.waypoints[currIdx];
      const wp2 = activeRoute.waypoints[nextIdx];

      const vesselLat = wp1.lat + subT * (wp2.lat - wp1.lat);
      const vesselLon = wp1.lon + subT * (wp2.lon - wp1.lon);
      const { x: vx, y: vy } = latLonToCanvas(vesselLat, vesselLon, width, height, viewport);

      ctx.beginPath();
      ctx.arc(vx, vy, 7, 0, 2 * Math.PI);
      ctx.fillStyle = '#38ef7d';
      ctx.shadowColor = '#38ef7d';
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      labelsToDraw.push({
        text: 'R/V BHARATI',
        tx: vx + 10,
        ty: vy + 4,
        color: '#38ef7d',
        font: 'bold 10px JetBrains Mono'
      });
    }

    // 6. Draw Icebergs & Drift Vector Trajectories
    if (showIcebergs) {
      icebergs.forEach((iceberg) => {
        const trajectory = iceberg.predictedTrajectory || iceberg.trajectory7Day;
        const currentLat = iceberg.lat + (forecastDay * (trajectory[1].lat - iceberg.lat));
        const currentLon = iceberg.lon + (forecastDay * (trajectory[1].lon - iceberg.lon));
        const { x, y } = latLonToCanvas(currentLat, currentLon, width, height, viewport);

        const isSelected = selectedIceberg?.id === iceberg.id;

        if (showVectors) {
          if (iceberg.predictedTrajectory) {
            iceberg.predictedTrajectory.forEach((pt, i, arr) => {
              if (i === 0) return;
              const prev = arr[i - 1];
              const { x: x1, y: y1 } = latLonToCanvas(prev.lat, prev.lon, width, height, viewport);
              const { x: x2, y: y2 } = latLonToCanvas(pt.lat, pt.lon, width, height, viewport);
              const r1 = (prev.uncertaintyRadiusKm / 111) * viewport.zoom * R_FACTOR;
              const r2 = (pt.uncertaintyRadiusKm / 111) * viewport.zoom * R_FACTOR;

              const angle = Math.atan2(y2 - y1, x2 - x1);
              const p1x = x1 + Math.cos(angle - Math.PI/2) * r1;
              const p1y = y1 + Math.sin(angle - Math.PI/2) * r1;
              const p2x = x1 + Math.cos(angle + Math.PI/2) * r1;
              const p2y = y1 + Math.sin(angle + Math.PI/2) * r1;
              const p3x = x2 + Math.cos(angle + Math.PI/2) * r2;
              const p3y = y2 + Math.sin(angle + Math.PI/2) * r2;
              const p4x = x2 + Math.cos(angle - Math.PI/2) * r2;
              const p4y = y2 + Math.sin(angle - Math.PI/2) * r2;

              ctx.beginPath();
              ctx.moveTo(p1x, p1y);
              ctx.lineTo(p2x, p2y);
              ctx.lineTo(p3x, p3y);
              ctx.lineTo(p4x, p4y);
              ctx.closePath();
              ctx.fillStyle = iceberg.hazardLevel === 'CRITICAL' ? 'rgba(255, 75, 92, 0.15)' : 'rgba(255, 183, 3, 0.15)';
              ctx.fill();

              ctx.beginPath();
              ctx.arc(x2, y2, r2, 0, 2 * Math.PI);
              ctx.fill();
            });
          }

          ctx.beginPath();
          trajectory.forEach((pt, i) => {
            const { x: tx, y: ty } = latLonToCanvas(pt.lat, pt.lon, width, height, viewport);
            if (i === 0) ctx.moveTo(tx, ty);
            else ctx.lineTo(tx, ty);
          });
          ctx.strokeStyle = iceberg.hazardLevel === 'CRITICAL' ? 'rgba(255, 75, 92, 0.8)' : 'rgba(255, 183, 3, 0.8)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        const size = Math.max(8, iceberg.lengthKm / 3);
        ctx.rect(x - size / 2, y - size / 2, size, size);
        ctx.fillStyle = isSelected ? '#ff4b5c' : '#ffffff';
        ctx.shadowColor = isSelected ? '#ff4b5c' : '#00f2fe';
        ctx.shadowBlur = isSelected ? 16 : 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = iceberg.hazardLevel === 'CRITICAL' ? '#ff4b5c' : '#00f2fe';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = isSelected ? '#ff4b5c' : '#e2e8f0';
        ctx.font = '10px Inter';
        ctx.fillText(iceberg.name.split(' ')[1] || iceberg.name, x + size + 4, y + 3);
      });
    }

    // 7. Draw Research Stations
    STATIONS.forEach((st) => {
      const { x, y } = latLonToCanvas(st.lat, st.lon, width, height, viewport);

      ctx.beginPath();
      ctx.arc(x, y, st.id.includes('BHARATI') || st.id.includes('MAITRI') ? 6 : 5, 0, 2 * Math.PI);
      ctx.fillStyle = st.country === 'India' ? '#ff9933' : '#00f2fe';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      labelsToDraw.push({
        text: st.name,
        tx: x + 8,
        ty: y + 4,
        color: '#ffffff',
        font: 'bold 11px Inter'
      });
    });

    // 8. Render Labels with Collision Avoidance
    const drawnBoxes: { x: number, y: number, w: number, h: number }[] = [];
    
    labelsToDraw.forEach(label => {
      ctx.font = label.font;
      const metrics = ctx.measureText(label.text);
      const w = metrics.width;
      const h = 12; // approximate height
      
      let finalX = label.tx;
      let finalY = label.ty;
      
      let collision = true;
      let attempts = 0;
      while (collision && attempts < 8) {
        collision = drawnBoxes.some(b => 
          finalX < b.x + b.w + 8 && 
          finalX + w + 8 > b.x && 
          finalY - h < b.y + 4 && 
          finalY + 4 > b.y - b.h
        );
        if (collision) {
          finalY += 14; // Push down to avoid
        }
        attempts++;
      }
      
      drawnBoxes.push({ x: finalX, y: finalY, w, h });
      
      // Optional: Draw a subtle leader line if pushed far down
      if (attempts > 1) {
        ctx.beginPath();
        ctx.moveTo(label.tx - 4, label.ty);
        ctx.lineTo(label.tx - 4, finalY - 4);
        ctx.lineTo(finalX - 2, finalY - 4);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      
      // Subtle text shadow for readability
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillStyle = label.color;
      ctx.fillText(label.text, finalX, finalY);
      ctx.shadowBlur = 0; // reset
    });

    ctx.restore();

  }, [routes, activeRouteId, selectedIceberg, forecastDay, showIcebergs, showHeatmap, showVectors, vesselProgress, icebergs, viewport, dimensions]);

  // Map Controls Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartPixelRef.current = { x: e.clientX, y: e.clientY };
    dragStartViewportRef.current = { ...viewport };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setHasManualOverride(true);
    
    const dx = e.clientX - dragStartPixelRef.current.x;
    const dy = e.clientY - dragStartPixelRef.current.y;
    
    // Reverse lookup to find new center
    // We want the original center pixel (which was at width/2, height/2) to have moved by dx, dy.
    // So the new center geographic coordinate is what used to be at width/2 - dx, height/2 - dy
    const newCenterLatLon = canvasToLatLon(
      dimensions.width / 2 - dx, 
      dimensions.height / 2 - dy, 
      dimensions.width, 
      dimensions.height, 
      dragStartViewportRef.current
    );
    
    setViewport({
      ...viewport,
      centerLat: newCenterLatLon.lat,
      centerLon: newCenterLatLon.lon
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    setHasManualOverride(true);
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Find what lat/lon is currently under the mouse
    const targetGeo = canvasToLatLon(mouseX, mouseY, dimensions.width, dimensions.height, viewport);
    
    // Calculate new zoom
    const zoomSensitivity = 0.002;
    let newZoom = viewport.zoom - e.deltaY * zoomSensitivity;
    newZoom = Math.max(MIN_ZOOM, Math.min(newZoom, MAX_ZOOM));
    
    // We want targetGeo to remain at mouseX, mouseY after zoom.
    // So we adjust centerLat/centerLon. 
    // It's a bit complex in a non-linear projection, so we approximate:
    setViewport({ ...viewport, zoom: newZoom });
  };
  
  const handleZoomIn = () => {
    setHasManualOverride(true);
    setViewport(v => ({ ...v, zoom: Math.min(v.zoom + 0.5, MAX_ZOOM) }));
  };

  const handleZoomOut = () => {
    setHasManualOverride(true);
    setViewport(v => ({ ...v, zoom: Math.max(v.zoom - 0.5, MIN_ZOOM) }));
  };

  return (
    <div className="map-container" ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Top Left Status Overlay */}
      <div className="map-overlay-top-left">
        <div className="map-card-sm">
          <div className="map-card-title">Antarctic Projection</div>
          <div className="map-card-value">Stereographic • 70.0° S</div>
        </div>
        <div className="map-card-sm">
          <div className="map-card-title">Active AI Route</div>
          <div className="map-card-value" style={{ color: '#00f2fe' }}>
            {activeRoute?.title}
          </div>
        </div>
      </div>

      {/* Top Right Layers Overlay */}
      <div className="map-overlay-top-right">
        <div className="map-card-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={14} color="#00f2fe" />
          <span style={{ fontSize: '0.78rem', color: '#8b9bb4' }}>
            AMSR2 Sea Ice • Day +{forecastDay}
          </span>
        </div>
      </div>
      
      {/* Viewport Controls Overlay */}
      <div style={{ position: 'absolute', bottom: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 10 }}>
        <button className="btn-header" onClick={handleZoomIn} style={{ padding: '8px', background: 'rgba(5, 11, 20, 0.85)', borderRadius: '8px', border: '1px solid var(--border-glass)', cursor: 'pointer' }}>
          <ZoomIn size={18} color="#00f2fe" />
        </button>
        <button className="btn-header" onClick={handleZoomOut} style={{ padding: '8px', background: 'rgba(5, 11, 20, 0.85)', borderRadius: '8px', border: '1px solid var(--border-glass)', cursor: 'pointer' }}>
          <ZoomOut size={18} color="#00f2fe" />
        </button>
        <button className="btn-header" onClick={fitToActiveRoute} style={{ padding: '8px', marginTop: '8px', background: 'rgba(5, 11, 20, 0.85)', borderRadius: '8px', border: hasManualOverride ? '1px solid #ffb703' : '1px solid rgba(0, 242, 254, 0.4)', cursor: 'pointer' }}>
          <Maximize size={18} color={hasManualOverride ? "#ffb703" : "#00f2fe"} />
        </button>
      </div>

      <canvas 
        ref={canvasRef} 
        className="map-canvas" 
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', display: 'block' }}
      />

      {/* Map Legend */}
      <div className="map-overlay-bottom-left" style={{ 
        position: 'absolute', bottom: '20px', left: '20px', 
        background: 'rgba(5, 11, 20, 0.85)', padding: '16px', 
        borderRadius: '8px', border: '1px solid var(--border-glass)',
        display: 'flex', flexDirection: 'column', gap: '12px',
        pointerEvents: 'none'
      }}>
        <div style={{ fontSize: '0.8rem', color: '#ffffff', fontWeight: 600, borderBottom: '1px solid rgba(0, 242, 254, 0.2)', paddingBottom: '6px' }}>
          Map Legend
        </div>
        
        {/* Routes Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem', color: '#8b9bb4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '20px', height: '3px', background: '#00f2fe', boxShadow: '0 0 6px #00f2fe' }}></div>
            <span>AI Optimal Route</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '20px', height: '2px', borderBottom: '2px dashed #ff4b5c' }}></div>
            <span>Direct Route (Hazard)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '20px', height: '2px', borderBottom: '2px dotted #ffb703' }}></div>
            <span>Coastal Route (Inefficient)</span>
          </div>
        </div>

        {/* Sea Ice Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem', color: '#8b9bb4', marginTop: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <div style={{ width: '12px', height: '12px', background: 'rgba(255, 255, 255, 0.8)' }}></div>
             <span>Fast Ice / Ice Shelf (&gt;90%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <div style={{ width: '12px', height: '12px', background: 'rgba(0, 242, 254, 0.45)' }}></div>
             <span>Heavy Pack Ice (60-90%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <div style={{ width: '12px', height: '12px', background: 'rgba(79, 172, 254, 0.3)' }}></div>
             <span>Marginal Ice Zone (40-60%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <div style={{ width: '12px', height: '12px', background: 'rgba(79, 172, 254, 0.15)' }}></div>
             <span>Sparse Ice (20-40%)</span>
          </div>
        </div>

        {/* Iceberg Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem', color: '#8b9bb4', marginTop: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <div style={{ width: '12px', height: '12px', border: '1px solid #00f2fe', background: '#ffffff', boxShadow: '0 0 4px #00f2fe' }}></div>
             <span>Iceberg Marker & Cone</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <div style={{ width: '12px', height: '12px', border: '1px solid #ff4b5c', background: '#ffffff', boxShadow: '0 0 4px #ff4b5c' }}></div>
             <span>Critical Iceberg Threat</span>
          </div>
        </div>
      </div>
    </div>
  );
};
