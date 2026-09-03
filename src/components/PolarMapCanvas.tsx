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
  originStationId: string;
  destinationStationId: string;
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
  showVectors,
  originStationId,
  destinationStationId
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  const [dimensions, setDimensions] = useState({ width: 900, height: 650 });
  const [viewport, setViewport] = useState({ centerLat: -65.0, centerLon: 45.0, zoom: 1.4 });
  const [hasManualOverride, setHasManualOverride] = useState(false);
  const [hoveredStationId, setHoveredStationId] = useState<string | null>(null);
  const [hoveredHazard, setHoveredHazard] = useState<{ x: number, y: number, text: string } | null>(null);
  
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

    const newViewport = computeFitViewport(points, dimensions.width, dimensions.height, 80);
    setViewport(newViewport);
    setHasManualOverride(false);
  }, [activeRoute, dimensions, icebergs]);

  // Auto-fit on route change if no manual override
  useEffect(() => {
    if (!hasManualOverride) {
      fitToActiveRoute();
    }
  }, [activeRouteId, routes, dimensions.width, dimensions.height, hasManualOverride, fitToActiveRoute]);

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

    // 1. Draw Polar Grid Rings (-60°, -70°) and Longitude Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    
    // Rings
    [-60, -70].forEach((lat) => {
      const center = latLonToCanvas(lat, viewport.centerLon, width, height, viewport);
      const r = (90 + lat) * viewport.zoom * R_FACTOR;
      ctx.beginPath();
      ctx.arc(center.x, center.y, r, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.font = '10px Inter';
      ctx.fillText(`${lat}° S`, center.x + 4, center.y - r + 12);
    });

    // Faint Longitude Reference Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    for (let lon = -180; lon < 180; lon += 30) {
      const center = latLonToCanvas(-90, lon, width, height, viewport);
      const outer = latLonToCanvas(-50, lon, width, height, viewport);
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(outer.x, outer.y);
      ctx.stroke();
    }

    // Pre-calculate continent path to use for both land masking and drawing
    const antarcticPoints = [
      { lat: -63.3, lon: -57.0 },  // Antarctic Peninsula Tip
      { lat: -73.0, lon: -60.0 },  // Palmer Land
      { lat: -74.0, lon: -75.0 },  // Ellsworth Land
      { lat: -73.0, lon: -100.0 }, // Amundsen Sea coast
      { lat: -75.0, lon: -140.0 }, // Marie Byrd Land
      { lat: -78.0, lon: -160.0 }, // Ross Ice Shelf edge
      { lat: -77.8, lon: 166.0 },  // McMurdo area
      { lat: -70.0, lon: 160.0 },  // Victoria Land
      { lat: -66.0, lon: 140.0 },  // Wilkes Land
      { lat: -65.0, lon: 110.0 },  // Law Dome
      { lat: -67.0, lon: 90.0 },   // Mirny area
      { lat: -69.4, lon: 76.2 },   // Bharati area (Prydz Bay)
      { lat: -68.0, lon: 60.0 },   // Mac Robertson Land
      { lat: -69.0, lon: 40.0 },   // Enderby Land
      { lat: -70.7, lon: 11.7 },   // Maitri area (Queen Maud Land)
      { lat: -72.0, lon: -10.0 },  // Princess Astrid Coast
      { lat: -75.0, lon: -25.0 },  // Weddell Sea coast
      { lat: -74.0, lon: -40.0 },  // Filchner Ice Shelf
      { lat: -68.0, lon: -60.0 }   // Back to Peninsula base
    ];

    const continentPath = new Path2D();
    const pts = antarcticPoints.map(pt => latLonToCanvas(pt.lat, pt.lon, width, height, viewport));
    
    if (pts.length > 0) {
      continentPath.moveTo(pts[0].x, pts[0].y);
      for (let i = 0; i < pts.length; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % pts.length];
        const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        
        if (i === 0) {
          continentPath.lineTo(midPoint.x, midPoint.y);
        } else {
          continentPath.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
        }
      }
      continentPath.lineTo(pts[0].x, pts[0].y);
    }
    continentPath.closePath();

    // 2. Draw Sea Ice Heatmap Layer (Geographic Grid)
    if (showHeatmap) {
      const confidenceAlpha = Math.max(0.3, (95 - (forecastDay * (30 / 7))) / 100);

      // Grid bounds: covers Southern Ocean & Antarctic coastal waters
      const latStep = 1.5;
      const lonStep = 3.0;

      for (let lat = -46; lat >= -82; lat -= latStep) {
        for (let lon = -180; lon <= 180; lon += lonStep) {
          // Check if cell is over land, skip if so
          const center = latLonToCanvas(lat, lon, width, height, viewport);
          if (ctx.isPointInPath(continentPath, center.x, center.y)) continue;

          const sic = getSicAt(lat, lon, forecastDay);
          
          if (sic < 20) continue; // Skip open water

          let fillColor = '';
          if (sic >= 90) {
            fillColor = `rgba(255, 255, 255, ${0.45 * confidenceAlpha})`; // Fast Ice / Ice Shelf
          } else if (sic >= 60) {
            fillColor = `rgba(180, 220, 255, ${0.25 * confidenceAlpha})`; // Heavy Pack Ice
          } else if (sic >= 40) {
            fillColor = `rgba(140, 200, 255, ${0.15 * confidenceAlpha})`; // Marginal Ice Zone
          } else { // 20-40%
            fillColor = `rgba(100, 180, 255, ${0.08 * confidenceAlpha})`; // Sparse Ice
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
    ctx.fillStyle = 'rgba(10, 18, 32, 0.7)';
    ctx.fill(continentPath);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
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
        ctx.strokeStyle = isSelected ? '#00f2fe' : 'rgba(0, 242, 254, 0.2)';
        ctx.lineWidth = isSelected ? 2 : 1;
      } else if (route.id === 'SHORTEST_DISTANCE') {
        ctx.strokeStyle = isSelected ? 'rgba(255, 75, 92, 0.8)' : 'rgba(255, 75, 92, 0.15)';
        ctx.lineWidth = isSelected ? 1.5 : 1;
      } else {
        ctx.strokeStyle = isSelected ? 'rgba(255, 183, 3, 0.8)' : 'rgba(255, 183, 3, 0.15)';
        ctx.lineWidth = isSelected ? 1.5 : 1;
      }

      ctx.stroke();

      if (isSelected) {
        // Draw evenly spaced small tracking dots along the active route
        route.waypoints.forEach((wp, wpIdx) => {
          if (wpIdx % 3 === 0) { // arbitrary spacing for tracker dots
            const { x, y } = latLonToCanvas(wp.lat, wp.lon, width, height, viewport);
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, 2 * Math.PI);
            ctx.fillStyle = route.id === 'OPTIMAL_AI' ? '#00f2fe' : (route.id === 'SHORTEST_DISTANCE' ? '#ff4b5c' : '#ffb703');
            ctx.fill();

            // Hazard marker check
            if (route.id === 'SHORTEST_DISTANCE' && route.routeRationale && route.routeRationale.hazardsAvoided) {
              const hazard = route.routeRationale.hazardsAvoided.find(h => h.icebergId === wp.nearestIcebergId);
              if (hazard && wp.distanceToNearestIcebergNmi && wp.distanceToNearestIcebergNmi < 15) {
                // Draw a small warning glyph
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(255, 75, 92, 0.4)';
                ctx.fill();
                ctx.strokeStyle = '#ff4b5c';
                ctx.lineWidth = 1;
                ctx.stroke();
                
                // Exclamation mark
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 8px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('!', x, y);
              }
            }
          }
        });
      }
    });

    // 5. Draw Vessel Progress
    if (activeRoute && activeRoute.waypoints.length > 0) {
      const totalVoyageDays = activeRoute.totalTimeHours / 24;
      const vesselProgress = Math.min(forecastDay / Math.max(0.1, totalVoyageDays), 1);

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
      ctx.arc(vx, vy, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#00f2fe';
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
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
        const trajectory = iceberg.trajectory;
        const dayIdx = Math.floor(forecastDay);
        const pt = trajectory.find(p => p.day === dayIdx) || trajectory[trajectory.length - 1];
        const currentLat = pt.lat;
        const currentLon = pt.lon;
        const { x, y } = latLonToCanvas(currentLat, currentLon, width, height, viewport);

        const isSelected = selectedIceberg?.id === iceberg.id;

        if (showVectors) {
          const forecastWindow = trajectory.slice(dayIdx, dayIdx + 8);

          forecastWindow.forEach((pt, i, arr) => {
            if (i === 0) return;
            const prev = arr[i - 1];
            const { x: x1, y: y1 } = latLonToCanvas(prev.lat, prev.lon, width, height, viewport);
            const { x: x2, y: y2 } = latLonToCanvas(pt.lat, pt.lon, width, height, viewport);
            
            const r1Km = (i - 1) * 1.5;
            const r2Km = i * 1.5;
            const r1 = (r1Km / 111) * viewport.zoom * R_FACTOR;
            const r2 = (r2Km / 111) * viewport.zoom * R_FACTOR;

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

          ctx.beginPath();
          forecastWindow.forEach((pt, i) => {
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
        const size = Math.max(4, iceberg.lengthKm / 5);
        ctx.rect(x - size / 2, y - size / 2, size, size);
        ctx.fillStyle = isSelected ? 'rgba(255, 183, 3, 0.8)' : (iceberg.hazardLevel === 'CRITICAL' ? 'rgba(255, 75, 92, 0.8)' : 'rgba(255, 255, 255, 0.2)');
        ctx.fill();

        ctx.strokeStyle = isSelected ? '#ffb703' : (iceberg.hazardLevel === 'CRITICAL' ? '#ff4b5c' : 'rgba(255, 255, 255, 0.4)');
        ctx.lineWidth = 1;
        ctx.stroke();

        if (isSelected || iceberg.hazardLevel === 'CRITICAL' || viewport.zoom > 1.5) {
          labelsToDraw.push({
            text: iceberg.name.split(' ')[1] || iceberg.name,
            tx: x + size + 4,
            ty: y + 3,
            color: isSelected ? '#ff4b5c' : '#e2e8f0',
            font: '10px Inter'
          });
        }
      });
    }

    // 7. Draw Research Stations
    STATIONS.forEach((st) => {
      const { x, y } = latLonToCanvas(st.lat, st.lon, width, height, viewport);
      const isSelected = st.id === originStationId || st.id === destinationStationId;
      const isHovered = st.id === hoveredStationId;
      const shouldShowLabel = isSelected || isHovered;

      ctx.beginPath();
      ctx.arc(x, y, shouldShowLabel ? 4 : 2, 0, 2 * Math.PI);
      ctx.fillStyle = shouldShowLabel ? (st.country === 'India' ? '#ffb703' : '#ffffff') : 'rgba(255, 255, 255, 0.3)';
      ctx.fill();
      
      if (shouldShowLabel) {
        ctx.strokeStyle = '#050b14';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        labelsToDraw.push({
          text: st.name,
          tx: x + 6,
          ty: y + 3,
          color: '#e2e8f0',
          font: '10px Inter'
        });
      }
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

  }, [routes, activeRouteId, selectedIceberg, forecastDay, showIcebergs, showHeatmap, showVectors, icebergs, viewport, dimensions, hoveredStationId, originStationId, destinationStationId]);

  // Map Controls Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartPixelRef.current = { x: e.clientX, y: e.clientY };
    dragStartViewportRef.current = { ...viewport };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDragging) {
      setHasManualOverride(true);
      const dx = e.clientX - dragStartPixelRef.current.x;
      const dy = e.clientY - dragStartPixelRef.current.y;
      
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
      return;
    }

    // Hover detection for stations
    let foundHover: string | null = null;
    let foundHazardHover: { x: number, y: number, text: string } | null = null;

    STATIONS.forEach(station => {
      const { x, y } = latLonToCanvas(station.lat, station.lon, dimensions.width, dimensions.height, viewport);
      if (Math.hypot(mouseX - x, mouseY - y) < 15) {
        foundHover = station.id;
      }
    });
    
    // Check hazards on SHORTEST_DISTANCE route
    const shortestRoute = routes.find(r => r.id === 'SHORTEST_DISTANCE');
    if (shortestRoute && shortestRoute.routeRationale) {
      shortestRoute.waypoints.forEach(wp => {
         const { x, y } = latLonToCanvas(wp.lat, wp.lon, dimensions.width, dimensions.height, viewport);
         if (Math.hypot(mouseX - x, mouseY - y) < 8) {
            const hazard = shortestRoute.routeRationale!.hazardsAvoided.find((h: any) => h.icebergId === wp.nearestIcebergId);
            if (hazard && wp.distanceToNearestIcebergNmi && wp.distanceToNearestIcebergNmi < 15) {
               foundHazardHover = {
                 x, y,
                 text: `${wp.distanceToNearestIcebergNmi} nmi from Iceberg ${hazard.icebergId} — CRITICAL hazard`
               };
            }
         }
      });
    }

    setHoveredStationId(foundHover);
    setHoveredHazard(foundHazardHover);
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
      {hoveredHazard && (
        <div style={{
          position: 'absolute',
          left: hoveredHazard.x + 15,
          top: hoveredHazard.y - 15,
          background: 'rgba(10, 18, 32, 0.95)',
          border: '1px solid #ff4b5c',
          borderRadius: '4px',
          padding: '6px 10px',
          color: '#fff',
          fontSize: '11px',
          pointerEvents: 'none',
          zIndex: 50,
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(255, 75, 92, 0.2)'
        }}>
          ⚠️ {hoveredHazard.text}
        </div>
      )}

      {/* Rationale Panel Overlay */}
      {activeRoute?.routeRationale && (
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          width: '320px',
          background: 'var(--bg-glass)',
          border: '1px solid rgba(0, 242, 254, 0.2)',
          borderRadius: '8px',
          padding: '16px',
          color: '#fff',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          zIndex: 10,
          pointerEvents: 'none' // allow clicking through
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--primary-cyan)', borderBottom: '1px solid rgba(0,242,254,0.2)', paddingBottom: '8px' }}>
            Why this path? (Day {activeRoute.routeRationale.day})
          </h3>
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', lineHeight: '1.4', color: 'var(--text-muted)' }}>
            {activeRoute.routeRationale.plainLanguageExplanation}
          </p>
          
          {activeRoute.routeRationale.hazardsAvoided.length > 0 && (
            <div style={{ marginBottom: '12px', padding: '8px', background: 'rgba(255, 75, 92, 0.1)', borderRadius: '4px', borderLeft: '2px solid var(--accent-red)' }}>
              <div style={{ fontSize: '11px', color: 'var(--accent-red)', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 'bold' }}>Avoided Hazard</div>
              {activeRoute.routeRationale.hazardsAvoided.map(h => (
                <div key={h.icebergId} style={{ fontSize: '12px' }}>
                  <strong>{h.icebergId}</strong>: Direct clearance {h.distanceIfDirectNmi}nmi vs AI {h.distanceOnAIRouteNmi}nmi
                </div>
              ))}
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>AI Route Ice</div>
              <div style={{ fontWeight: 'bold' }}>{activeRoute.routeRationale.iceConcentrationComparison.aiRouteAvgPct}% Avg</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'var(--text-muted)' }}>Direct Route Ice</div>
              <div style={{ fontWeight: 'bold', color: 'var(--accent-amber)' }}>{activeRoute.routeRationale.iceConcentrationComparison.directRouteAvgPct}% Avg</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
