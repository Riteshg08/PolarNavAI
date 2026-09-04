import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RouteOption, Iceberg, StationLocation } from '../types';
import { STATIONS } from '../data/stations';
import { ICEBERGS } from '../data/icebergs';
import { VESSELS } from '../data/vessels';
import { getSicAt } from '../models/seaIceForecast';
import { Compass, Layers, ShieldAlert, Navigation, ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw, Ship } from 'lucide-react';

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
  if (points.length === 0) return { centerLat: -67, centerLon: 45, zoom: 1.4 };
  
  // Filter points to the Antarctic sector (lat <= -50) to prevent port-of-origin (Cape Town at -33) from distorting polar center
  const polarPoints = points.filter(p => p.lat <= -50);
  const targetPoints = polarPoints.length > 0 ? polarPoints : points;

  let minLat = 90, maxLat = -90;
  let sumLonX = 0, sumLonY = 0;
  
  targetPoints.forEach(p => {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    const rad = (p.lon * Math.PI) / 180;
    sumLonX += Math.cos(rad);
    sumLonY += Math.sin(rad);
  });
  
  const centerLat = Math.min(-62.0, Math.max(-76.0, (minLat + maxLat) / 2));
  let centerLon = (Math.atan2(sumLonY, sumLonX) * 180) / Math.PI;
  if (isNaN(centerLon)) centerLon = 45.0;

  // Determine optimal polar zoom based on latitude/longitude span
  const latSpan = Math.abs(maxLat - minLat);
  let bestZoom = 1.4;
  if (latSpan > 18) bestZoom = 1.1;
  else if (latSpan > 10) bestZoom = 1.3;
  else bestZoom = 1.6;

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredStationId, setHoveredStationId] = useState<string | null>(null);
  const [hoveredHazard, setHoveredHazard] = useState<{ x: number, y: number, text: string } | null>(null);
  
  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPixelRef = useRef({ x: 0, y: 0 });
  const dragStartViewportRef = useRef(viewport);

  // Resize Listener & Fullscreen Change Listener
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleFsChange);
    handleResize();
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, []);

  const activeRoute = routes.find((r) => r.id === activeRouteId) || routes[0];

  const fitToActiveRoute = useCallback(() => {
    if (!activeRoute || dimensions.width === 0 || dimensions.height === 0) return;
    
    const points: {lat: number; lon: number}[] = [];
    activeRoute.waypoints.forEach(wp => points.push({ lat: wp.lat, lon: wp.lon }));

    const newViewport = computeFitViewport(points, dimensions.width, dimensions.height, 80);
    setViewport(newViewport);
    setHasManualOverride(false);
  }, [activeRoute, dimensions]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Live Vessel Position & Navigation Heading
  const vesselNavInfo = useCallback(() => {
    if (!activeRoute || activeRoute.waypoints.length === 0 || dimensions.width === 0) return null;

    const totalVoyageDays = activeRoute.totalTimeHours / 24;
    const vesselProgress = Math.min(forecastDay / Math.max(0.1, totalVoyageDays), 1);
    const arrived = vesselProgress >= 1.0;

    const idxFloat = vesselProgress * (activeRoute.waypoints.length - 1);
    const currIdx = Math.floor(idxFloat);
    const nextIdx = Math.min(currIdx + 1, activeRoute.waypoints.length - 1);
    const subT = idxFloat - currIdx;

    const wp1 = activeRoute.waypoints[currIdx];
    const wp2 = activeRoute.waypoints[nextIdx];

    const vesselLat = wp1.lat + subT * (wp2.lat - wp1.lat);
    const vesselLon = wp1.lon + subT * (wp2.lon - wp1.lon);
    const { x, y } = latLonToCanvas(vesselLat, vesselLon, dimensions.width, dimensions.height, viewport);

    const p1 = latLonToCanvas(wp1.lat, wp1.lon, dimensions.width, dimensions.height, viewport);
    const p2 = latLonToCanvas(wp2.lat, wp2.lon, dimensions.width, dimensions.height, viewport);
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const headingRad = Math.atan2(dy, dx);
    const headingDeg = (headingRad * 180) / Math.PI + 90;

    const vesselProfile = VESSELS[0];

    return {
      x,
      y,
      headingDeg,
      speedKnots: wp1.speedKnots || 12,
      sicPct: Math.round(wp1.iceConcentrationPct || 0),
      vesselName: vesselProfile.name.split(' ')[1] || 'Bharati',
      polarClass: vesselProfile.polarClass,
      arrived,
      progressPct: Math.round(vesselProgress * 100)
    };
  }, [activeRoute, forecastDay, dimensions, viewport])();

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

    // 1. Draw Polar Grid Rings and Longitude Lines (zoom-adaptive)
    ctx.lineWidth = 1;
    
    // Determine which latitude rings to show based on zoom
    const latRings: number[] = [-60, -70];
    if (viewport.zoom > 1.5) {
      latRings.push(-55, -65, -75);
    }
    if (viewport.zoom > 2.5) {
      latRings.push(-50, -52, -58, -62, -68, -72, -78, -80);
    }
    
    latRings.sort((a, b) => b - a).forEach((lat) => {
      const center = latLonToCanvas(lat, viewport.centerLon, width, height, viewport);
      const r = (90 + lat) * viewport.zoom * R_FACTOR;
      ctx.beginPath();
      ctx.arc(center.x, center.y, r, 0, 2 * Math.PI);
      ctx.strokeStyle = (lat === -60 || lat === -70) ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.03)';
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = '10px Inter';
      ctx.fillText(`${lat}°`, center.x + 4, center.y - r + 12);
    });

    // Longitude Reference Lines (more visible when zoomed)
    const lonStep = viewport.zoom > 2.0 ? 15 : 30;
    for (let lon = -180; lon < 180; lon += lonStep) {
      const center = latLonToCanvas(-90, lon, width, height, viewport);
      const outer = latLonToCanvas(-45, lon, width, height, viewport);
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(outer.x, outer.y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.stroke();
      
      // Draw longitude labels when zoomed in
      if (viewport.zoom > 1.2) {
        const labelPos = latLonToCanvas(-48, lon, width, height, viewport);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.font = '9px Inter';
        ctx.fillText(`${lon}°`, labelPos.x - 10, labelPos.y);
      }
    }

    // Pre-calculate continent path to use for both land masking and drawing
    const antarcticPoints = [
      { lat: -64.152, lon: -58.614 },
      { lat: -64.368, lon: -59.045 },
      { lat: -64.211, lon: -59.789 },
      { lat: -64.309, lon: -60.612 },
      { lat: -64.544, lon: -61.297 },
      { lat: -64.799, lon: -62.022 },
      { lat: -65.093, lon: -62.512 },
      { lat: -65.485, lon: -62.649 },
      { lat: -65.857, lon: -62.590 },
      { lat: -66.190, lon: -62.120 },
      { lat: -66.426, lon: -62.806 },
      { lat: -66.504, lon: -63.746 },
      { lat: -66.837, lon: -64.294 },
      { lat: -67.150, lon: -64.882 },
      { lat: -67.582, lon: -65.508 },
      { lat: -67.954, lon: -65.665 },
      { lat: -68.365, lon: -65.313 },
      { lat: -68.679, lon: -64.784 },
      { lat: -68.914, lon: -63.961 },
      { lat: -69.228, lon: -63.197 },
      { lat: -69.619, lon: -62.786 },
      { lat: -69.992, lon: -62.571 },
      { lat: -70.384, lon: -62.277 },
      { lat: -70.717, lon: -61.807 },
      { lat: -71.089, lon: -61.513 },
      { lat: -72.010, lon: -61.376 },
      { lat: -72.382, lon: -61.082 },
      { lat: -72.774, lon: -61.004 },
      { lat: -73.166, lon: -60.690 },
      { lat: -73.695, lon: -60.827 },
      { lat: -74.107, lon: -61.376 },
      { lat: -74.440, lon: -61.963 },
      { lat: -74.577, lon: -63.295 },
      { lat: -74.930, lon: -63.746 },
      { lat: -75.263, lon: -64.353 },
      { lat: -75.635, lon: -65.861 },
      { lat: -75.792, lon: -67.193 },
      { lat: -76.007, lon: -68.446 },
      { lat: -76.223, lon: -69.798 },
      { lat: -76.634, lon: -70.601 },
      { lat: -76.674, lon: -72.207 },
      { lat: -76.634, lon: -73.970 },
      { lat: -76.713, lon: -75.556 },
      { lat: -76.713, lon: -77.240 },
      { lat: -77.105, lon: -76.927 },
      { lat: -77.281, lon: -75.399 },
      { lat: -77.555, lon: -74.283 },
      { lat: -77.908, lon: -73.656 },
      { lat: -78.222, lon: -74.773 },
      { lat: -78.124, lon: -76.496 },
      { lat: -78.378, lon: -77.926 },
      { lat: -78.790, lon: -77.985 },
      { lat: -79.182, lon: -78.024 },
      { lat: -79.515, lon: -76.849 },
      { lat: -79.887, lon: -76.633 },
      { lat: -80.260, lon: -75.360 },
      { lat: -80.416, lon: -73.245 },
      { lat: -80.691, lon: -71.443 },
      { lat: -81.004, lon: -70.013 },
      { lat: -81.318, lon: -68.192 },
      { lat: -81.474, lon: -65.704 },
      { lat: -81.749, lon: -63.256 },
      { lat: -82.043, lon: -61.552 },
      { lat: -82.376, lon: -59.691 },
      { lat: -82.846, lon: -58.712 },
      { lat: -83.218, lon: -58.222 },
      { lat: -82.866, lon: -57.008 },
      { lat: -82.572, lon: -55.363 },
      { lat: -82.258, lon: -53.620 },
      { lat: -82.004, lon: -51.544 },
      { lat: -81.729, lon: -49.761 },
      { lat: -81.710, lon: -47.274 },
      { lat: -81.847, lon: -44.826 },
      { lat: -82.082, lon: -42.808 },
      { lat: -81.651, lon: -42.162 },
      { lat: -81.357, lon: -40.771 },
      { lat: -81.337, lon: -38.245 },
      { lat: -81.122, lon: -36.267 },
      { lat: -80.906, lon: -34.386 },
      { lat: -80.769, lon: -32.310 },
      { lat: -80.593, lon: -30.097 },
      { lat: -80.338, lon: -28.550 },
      { lat: -79.985, lon: -29.255 },
      { lat: -79.633, lon: -29.686 },
      { lat: -79.260, lon: -29.686 },
      { lat: -79.299, lon: -31.625 },
      { lat: -79.456, lon: -33.681 },
      { lat: -79.456, lon: -35.640 },
      { lat: -79.084, lon: -35.914 },
      { lat: -78.339, lon: -35.777 },
      { lat: -78.124, lon: -35.327 },
      { lat: -77.889, lon: -33.897 },
      { lat: -77.653, lon: -32.212 },
      { lat: -77.360, lon: -30.998 },
      { lat: -77.066, lon: -29.784 },
      { lat: -76.674, lon: -28.883 },
      { lat: -76.497, lon: -27.512 },
      { lat: -76.360, lon: -26.160 },
      { lat: -76.282, lon: -25.475 },
      { lat: -76.243, lon: -23.928 },
      { lat: -76.105, lon: -22.459 },
      { lat: -75.909, lon: -21.225 },
      { lat: -75.674, lon: -20.010 },
      { lat: -75.439, lon: -18.914 },
      { lat: -75.126, lon: -17.523 },
      { lat: -74.793, lon: -16.642 },
      { lat: -74.499, lon: -15.701 },
      { lat: -74.107, lon: -15.408 },
      { lat: -73.872, lon: -16.465 },
      { lat: -73.460, lon: -16.113 },
      { lat: -73.147, lon: -15.447 },
      { lat: -72.951, lon: -14.409 },
      { lat: -72.715, lon: -13.312 },
      { lat: -72.402, lon: -12.294 },
      { lat: -72.010, lon: -11.510 },
      { lat: -71.540, lon: -11.020 },
      { lat: -71.265, lon: -10.296 },
      { lat: -71.324, lon: -9.101 },
      { lat: -71.657, lon: -8.611 },
      { lat: -71.697, lon: -7.417 },
      { lat: -71.324, lon: -7.377 },
      { lat: -70.932, lon: -6.868 },
      { lat: -71.030, lon: -5.791 },
      { lat: -71.403, lon: -5.536 },
      { lat: -71.461, lon: -4.342 },
      { lat: -71.285, lon: -3.049 },
      { lat: -71.167, lon: -1.795 },
      { lat: -71.226, lon: -0.659 },
      { lat: -71.638, lon: -0.229 },
      { lat: -71.305, lon: 0.868 },
      { lat: -71.128, lon: 1.887 },
      { lat: -70.991, lon: 3.023 },
      { lat: -70.854, lon: 4.139 },
      { lat: -70.619, lon: 5.158 },
      { lat: -70.462, lon: 6.274 },
      { lat: -70.247, lon: 7.136 },
      { lat: -69.894, lon: 7.743 },
      { lat: -70.149, lon: 8.487 },
      { lat: -70.011, lon: 9.525 },
      { lat: -70.482, lon: 10.250 },
      { lat: -70.834, lon: 10.818 },
      { lat: -70.638, lon: 11.954 },
      { lat: -70.247, lon: 12.404 },
      { lat: -69.972, lon: 13.423 },
      { lat: -70.031, lon: 14.735 },
      { lat: -70.403, lon: 15.127 },
      { lat: -70.031, lon: 15.949 },
      { lat: -69.913, lon: 17.027 },
      { lat: -69.874, lon: 18.202 },
      { lat: -69.894, lon: 19.259 },
      { lat: -70.011, lon: 20.376 },
      { lat: -70.070, lon: 21.453 },
      { lat: -70.403, lon: 21.923 },
      { lat: -70.697, lon: 22.569 },
      { lat: -70.521, lon: 23.666 },
      { lat: -70.482, lon: 24.841 },
      { lat: -70.482, lon: 25.977 },
      { lat: -70.462, lon: 27.094 },
      { lat: -70.325, lon: 28.093 },
      { lat: -70.207, lon: 29.150 },
      { lat: -69.933, lon: 30.032 },
      { lat: -69.757, lon: 30.972 },
      { lat: -69.659, lon: 31.990 },
      { lat: -69.384, lon: 32.754 },
      { lat: -68.836, lon: 33.302 },
      { lat: -68.503, lon: 33.870 },
      { lat: -68.659, lon: 34.908 },
      { lat: -69.012, lon: 35.300 },
      { lat: -69.247, lon: 36.162 },
      { lat: -69.169, lon: 37.200 },
      { lat: -69.521, lon: 37.905 },
      { lat: -69.776, lon: 38.649 },
      { lat: -69.541, lon: 39.668 },
      { lat: -69.110, lon: 40.020 },
      { lat: -68.934, lon: 40.921 },
      { lat: -68.601, lon: 41.959 },
      { lat: -68.463, lon: 42.939 },
      { lat: -68.267, lon: 44.114 },
      { lat: -68.052, lon: 44.897 },
      { lat: -67.817, lon: 45.720 },
      { lat: -67.601, lon: 46.503 },
      { lat: -67.719, lon: 47.443 },
      { lat: -67.366, lon: 48.344 },
      { lat: -67.092, lon: 48.991 },
      { lat: -67.111, lon: 49.931 },
      { lat: -66.876, lon: 50.753 },
      { lat: -66.523, lon: 50.949 },
      { lat: -66.249, lon: 51.792 },
      { lat: -66.053, lon: 52.614 },
      { lat: -65.896, lon: 53.613 },
      { lat: -65.818, lon: 54.534 },
      { lat: -65.877, lon: 55.415 },
      { lat: -65.975, lon: 56.355 },
      { lat: -66.249, lon: 57.158 },
      { lat: -66.680, lon: 57.256 },
      { lat: -67.013, lon: 58.137 },
      { lat: -67.288, lon: 58.745 },
      { lat: -67.405, lon: 59.939 },
      { lat: -67.680, lon: 60.605 },
      { lat: -67.954, lon: 61.428 },
      { lat: -68.013, lon: 62.387 },
      { lat: -67.817, lon: 63.190 },
      { lat: -67.405, lon: 64.052 },
      { lat: -67.621, lon: 64.992 },
      { lat: -67.738, lon: 65.972 },
      { lat: -67.856, lon: 66.912 },
      { lat: -67.934, lon: 67.891 },
      { lat: -67.934, lon: 68.890 },
      { lat: -68.973, lon: 69.713 },
      { lat: -69.228, lon: 69.673 },
      { lat: -69.678, lon: 69.556 },
      { lat: -69.933, lon: 68.596 },
      { lat: -70.305, lon: 67.813 },
      { lat: -70.697, lon: 67.950 },
      { lat: -70.678, lon: 69.066 },
      { lat: -71.069, lon: 68.929 },
      { lat: -71.442, lon: 68.420 },
      { lat: -71.853, lon: 67.950 },
      { lat: -72.167, lon: 68.714 },
      { lat: -72.265, lon: 69.869 },
      { lat: -72.088, lon: 71.025 },
      { lat: -71.697, lon: 71.573 },
      { lat: -71.324, lon: 71.906 },
      { lat: -71.011, lon: 72.455 },
      { lat: -70.717, lon: 73.081 },
      { lat: -70.364, lon: 73.336 },
      { lat: -69.874, lon: 73.865 },
      { lat: -69.776, lon: 74.492 },
      { lat: -69.737, lon: 75.628 },
      { lat: -69.619, lon: 76.626 },
      { lat: -69.463, lon: 77.645 },
      { lat: -69.071, lon: 78.135 },
      { lat: -68.698, lon: 78.428 },
      { lat: -68.326, lon: 79.114 },
      { lat: -68.072, lon: 80.093 },
      { lat: -67.876, lon: 80.935 },
      { lat: -67.542, lon: 81.484 },
      { lat: -67.366, lon: 82.052 },
      { lat: -67.209, lon: 82.776 },
      { lat: -67.307, lon: 83.775 },
      { lat: -67.209, lon: 84.676 },
      { lat: -67.092, lon: 85.656 },
      { lat: -67.150, lon: 86.752 },
      { lat: -66.876, lon: 87.477 },
      { lat: -66.210, lon: 87.986 },
      { lat: -66.484, lon: 88.358 },
      { lat: -66.955, lon: 88.828 },
      { lat: -67.150, lon: 89.671 },
      { lat: -67.229, lon: 90.630 },
      { lat: -67.111, lon: 91.590 },
      { lat: -67.190, lon: 92.609 },
      { lat: -67.209, lon: 93.549 },
      { lat: -67.111, lon: 94.175 },
      { lat: -67.170, lon: 95.018 },
      { lat: -67.386, lon: 95.781 },
      { lat: -67.249, lon: 96.682 },
      { lat: -67.249, lon: 97.760 },
      { lat: -67.111, lon: 98.680 },
      { lat: -67.249, lon: 99.718 },
      { lat: -66.915, lon: 100.384 },
      { lat: -66.582, lon: 100.893 },
      { lat: -66.308, lon: 101.579 },
      { lat: -65.563, lon: 102.832 },
      { lat: -65.700, lon: 103.479 },
      { lat: -65.975, lon: 104.243 },
      { lat: -66.328, lon: 104.908 },
      { lat: -66.935, lon: 106.182 },
      { lat: -66.955, lon: 107.161 },
      { lat: -66.955, lon: 108.081 },
      { lat: -66.837, lon: 109.159 },
      { lat: -66.700, lon: 110.236 },
      { lat: -66.426, lon: 111.058 },
      { lat: -66.132, lon: 111.744 },
      { lat: -66.092, lon: 112.860 },
      { lat: -65.877, lon: 113.605 },
      { lat: -66.073, lon: 114.388 },
      { lat: -66.386, lon: 114.897 },
      { lat: -66.700, lon: 115.602 },
      { lat: -66.661, lon: 116.699 },
      { lat: -66.915, lon: 117.385 },
      { lat: -67.170, lon: 118.579 },
      { lat: -67.268, lon: 119.833 },
      { lat: -67.190, lon: 120.871 },
      { lat: -66.876, lon: 121.654 },
      { lat: -66.563, lon: 122.320 },
      { lat: -66.484, lon: 123.221 },
      { lat: -66.621, lon: 124.122 },
      { lat: -66.719, lon: 125.160 },
      { lat: -66.563, lon: 126.100 },
      { lat: -66.563, lon: 127.001 },
      { lat: -66.661, lon: 127.883 },
      { lat: -66.759, lon: 128.803 },
      { lat: -66.582, lon: 129.704 },
      { lat: -66.426, lon: 130.781 },
      { lat: -66.386, lon: 131.800 },
      { lat: -66.386, lon: 132.936 },
      { lat: -66.288, lon: 133.856 },
      { lat: -66.210, lon: 134.757 },
      { lat: -65.720, lon: 135.032 },
      { lat: -65.309, lon: 135.071 },
      { lat: -65.583, lon: 135.697 },
      { lat: -66.034, lon: 135.874 },
      { lat: -66.445, lon: 136.207 },
      { lat: -66.778, lon: 136.618 },
      { lat: -66.955, lon: 137.460 },
      { lat: -66.896, lon: 138.596 },
      { lat: -66.876, lon: 139.908 },
      { lat: -66.817, lon: 140.809 },
      { lat: -66.817, lon: 142.122 },
      { lat: -66.798, lon: 143.062 },
      { lat: -66.837, lon: 144.374 },
      { lat: -66.915, lon: 145.490 },
      { lat: -67.229, lon: 146.196 },
      { lat: -67.601, lon: 146.000 },
      { lat: -67.895, lon: 146.646 },
      { lat: -68.130, lon: 147.723 },
      { lat: -68.385, lon: 148.840 },
      { lat: -68.561, lon: 150.132 },
      { lat: -68.718, lon: 151.484 },
      { lat: -68.875, lon: 152.502 },
      { lat: -68.895, lon: 153.638 },
      { lat: -68.561, lon: 154.285 },
      { lat: -68.836, lon: 155.166 },
      { lat: -69.149, lon: 155.930 },
      { lat: -69.384, lon: 156.811 },
      { lat: -69.482, lon: 158.026 },
      { lat: -69.600, lon: 159.181 },
      { lat: -69.992, lon: 159.671 },
      { lat: -70.227, lon: 160.807 },
      { lat: -70.580, lon: 161.570 },
      { lat: -70.736, lon: 162.687 },
      { lat: -70.717, lon: 163.842 },
      { lat: -70.776, lon: 164.920 },
      { lat: -70.756, lon: 166.114 },
      { lat: -70.834, lon: 167.309 },
      { lat: -70.971, lon: 168.426 },
      { lat: -71.207, lon: 169.464 },
      { lat: -71.403, lon: 170.502 },
      { lat: -71.697, lon: 171.207 },
      { lat: -72.088, lon: 171.089 },
      { lat: -72.441, lon: 170.560 },
      { lat: -72.892, lon: 170.110 },
      { lat: -73.245, lon: 169.757 },
      { lat: -73.656, lon: 169.287 },
      { lat: -73.813, lon: 167.975 },
      { lat: -74.165, lon: 167.387 },
      { lat: -74.381, lon: 166.095 },
      { lat: -74.773, lon: 165.644 },
      { lat: -75.145, lon: 164.959 },
      { lat: -75.459, lon: 164.234 },
      { lat: -75.870, lon: 163.823 },
      { lat: -76.243, lon: 163.568 },
      { lat: -76.693, lon: 163.470 },
      { lat: -77.066, lon: 163.490 },
      { lat: -77.457, lon: 164.058 },
      { lat: -77.830, lon: 164.273 },
      { lat: -78.183, lon: 164.743 },
      { lat: -78.320, lon: 166.604 },
      { lat: -78.751, lon: 166.996 },
      { lat: -78.907, lon: 165.194 },
      { lat: -79.123, lon: 163.666 },
      { lat: -79.162, lon: 161.766 },
      { lat: -79.730, lon: 160.924 },
      { lat: -80.201, lon: 160.748 },
      { lat: -80.573, lon: 160.317 },
      { lat: -80.945, lon: 159.788 },
      { lat: -81.279, lon: 161.120 },
      { lat: -81.690, lon: 161.629 },
      { lat: -82.062, lon: 162.491 },
      { lat: -82.395, lon: 163.705 },
      { lat: -82.709, lon: 165.096 },
      { lat: -83.022, lon: 166.604 },
      { lat: -83.336, lon: 168.896 },
      { lat: -83.826, lon: 169.405 },
      { lat: -84.041, lon: 172.284 },
      { lat: -84.118, lon: 172.477 },
      { lat: -84.414, lon: 173.224 },
      { lat: -84.159, lon: 175.986 },
      { lat: -84.473, lon: 178.277 },
      { lat: -84.713, lon: 180.000 },
      { lat: -84.721, lon: -179.942 },
      { lat: -84.139, lon: -179.059 },
      { lat: -84.453, lon: -177.257 },
      { lat: -84.418, lon: -177.141 },
      { lat: -84.099, lon: -176.085 },
      { lat: -84.110, lon: -175.947 },
      { lat: -84.118, lon: -175.830 },
      { lat: -84.534, lon: -174.383 },
      { lat: -84.118, lon: -173.117 },
      { lat: -84.061, lon: -172.889 },
      { lat: -83.885, lon: -169.951 },
      { lat: -84.118, lon: -169.000 },
      { lat: -84.237, lon: -168.530 },
      { lat: -84.570, lon: -167.022 },
      { lat: -84.825, lon: -164.182 },
      { lat: -85.139, lon: -161.930 },
      { lat: -85.374, lon: -158.071 },
      { lat: -85.100, lon: -155.192 },
      { lat: -85.296, lon: -150.942 },
      { lat: -85.609, lon: -148.533 },
      { lat: -85.315, lon: -145.889 },
      { lat: -85.041, lon: -143.108 },
      { lat: -84.570, lon: -142.892 },
      { lat: -84.531, lon: -146.829 },
      { lat: -84.296, lon: -150.061 },
      { lat: -83.904, lon: -150.903 },
      { lat: -83.689, lon: -153.586 },
      { lat: -83.238, lon: -153.410 },
      { lat: -82.827, lon: -153.038 },
      { lat: -82.454, lon: -152.666 },
      { lat: -82.043, lon: -152.862 },
      { lat: -81.768, lon: -154.526 },
      { lat: -81.416, lon: -155.290 },
      { lat: -81.102, lon: -156.837 },
      { lat: -81.161, lon: -154.409 },
      { lat: -81.004, lon: -152.098 },
      { lat: -81.337, lon: -150.648 },
      { lat: -81.043, lon: -148.866 },
      { lat: -80.671, lon: -147.221 },
      { lat: -80.338, lon: -146.418 },
      { lat: -79.926, lon: -146.770 },
      { lat: -79.652, lon: -148.063 },
      { lat: -79.358, lon: -149.532 },
      { lat: -79.299, lon: -151.588 },
      { lat: -79.162, lon: -153.390 },
      { lat: -79.064, lon: -155.329 },
      { lat: -78.692, lon: -155.976 },
      { lat: -78.378, lon: -157.268 },
      { lat: -78.026, lon: -158.052 },
      { lat: -76.889, lon: -158.365 },
      { lat: -76.987, lon: -157.875 },
      { lat: -77.301, lon: -156.975 },
      { lat: -77.203, lon: -155.329 },
      { lat: -77.066, lon: -153.743 },
      { lat: -77.497, lon: -152.920 },
      { lat: -77.399, lon: -151.334 },
      { lat: -77.183, lon: -150.002 },
      { lat: -76.909, lon: -148.748 },
      { lat: -76.576, lon: -147.612 },
      { lat: -76.478, lon: -146.104 },
      { lat: -76.105, lon: -146.144 },
      { lat: -75.733, lon: -146.496 },
      { lat: -75.380, lon: -146.202 },
      { lat: -75.204, lon: -144.910 },
      { lat: -75.537, lon: -144.322 },
      { lat: -75.341, lon: -142.794 },
      { lat: -75.086, lon: -141.639 },
      { lat: -75.067, lon: -140.209 },
      { lat: -74.969, lon: -138.858 },
      { lat: -74.734, lon: -137.506 },
      { lat: -74.518, lon: -136.429 },
      { lat: -74.303, lon: -135.215 },
      { lat: -74.361, lon: -134.431 },
      { lat: -74.440, lon: -133.746 },
      { lat: -74.303, lon: -132.257 },
      { lat: -74.479, lon: -130.925 },
      { lat: -74.459, lon: -129.554 },
      { lat: -74.322, lon: -128.242 },
      { lat: -74.420, lon: -126.891 },
      { lat: -74.518, lon: -125.402 },
      { lat: -74.479, lon: -124.011 },
      { lat: -74.499, lon: -122.562 },
      { lat: -74.518, lon: -121.074 },
      { lat: -74.479, lon: -119.703 },
      { lat: -74.185, lon: -118.684 },
      { lat: -74.028, lon: -117.470 },
      { lat: -74.244, lon: -116.216 },
      { lat: -74.068, lon: -115.022 },
      { lat: -73.715, lon: -113.944 },
      { lat: -74.028, lon: -113.298 },
      { lat: -74.381, lon: -112.945 },
      { lat: -74.714, lon: -112.299 },
      { lat: -74.420, lon: -111.261 },
      { lat: -74.793, lon: -110.066 },
      { lat: -74.910, lon: -108.715 },
      { lat: -75.184, lon: -107.559 },
      { lat: -75.126, lon: -106.149 },
      { lat: -74.949, lon: -104.876 },
      { lat: -74.988, lon: -103.368 },
      { lat: -75.126, lon: -102.017 },
      { lat: -75.302, lon: -100.646 },
      { lat: -74.871, lon: -100.117 },
      { lat: -74.538, lon: -100.763 },
      { lat: -74.185, lon: -101.253 },
      { lat: -74.107, lon: -102.545 },
      { lat: -73.734, lon: -103.113 },
      { lat: -73.362, lon: -103.329 },
      { lat: -72.618, lon: -103.681 },
      { lat: -72.755, lon: -102.917 },
      { lat: -72.813, lon: -101.605 },
      { lat: -72.755, lon: -100.313 },
      { lat: -72.911, lon: -99.137 },
      { lat: -73.205, lon: -98.119 },
      { lat: -73.558, lon: -97.688 },
      { lat: -73.617, lon: -96.337 },
      { lat: -73.480, lon: -95.044 },
      { lat: -73.284, lon: -93.673 },
      { lat: -73.166, lon: -92.439 },
      { lat: -73.401, lon: -91.421 },
      { lat: -73.323, lon: -90.089 },
      { lat: -72.559, lon: -89.227 },
      { lat: -73.009, lon: -88.424 },
      { lat: -73.186, lon: -87.268 },
      { lat: -73.088, lon: -86.015 },
      { lat: -73.480, lon: -85.192 },
      { lat: -73.519, lon: -83.880 },
      { lat: -73.636, lon: -82.666 },
      { lat: -73.852, lon: -81.471 },
      { lat: -73.480, lon: -80.687 },
      { lat: -73.127, lon: -80.296 },
      { lat: -73.519, lon: -79.297 },
      { lat: -73.421, lon: -77.926 },
      { lat: -73.636, lon: -76.907 },
      { lat: -73.970, lon: -76.222 },
      { lat: -73.872, lon: -74.890 },
      { lat: -73.656, lon: -73.852 },
      { lat: -73.401, lon: -72.834 },
      { lat: -73.264, lon: -71.619 },
      { lat: -73.147, lon: -70.209 },
      { lat: -73.009, lon: -68.936 },
      { lat: -72.794, lon: -67.957 },
      { lat: -72.480, lon: -67.369 },
      { lat: -72.049, lon: -67.134 },
      { lat: -71.638, lon: -67.252 },
      { lat: -71.246, lon: -67.565 },
      { lat: -70.854, lon: -67.917 },
      { lat: -70.462, lon: -68.231 },
      { lat: -70.109, lon: -68.485 },
      { lat: -69.717, lon: -68.544 },
      { lat: -69.326, lon: -68.446 },
      { lat: -68.953, lon: -67.976 },
      { lat: -68.542, lon: -67.585 },
      { lat: -68.150, lon: -67.428 },
      { lat: -67.719, lon: -67.624 },
      { lat: -67.327, lon: -67.741 },
      { lat: -66.876, lon: -67.252 },
      { lat: -66.582, lon: -66.703 },
      { lat: -66.210, lon: -66.057 },
      { lat: -65.896, lon: -65.371 },
      { lat: -65.603, lon: -64.568 },
      { lat: -65.171, lon: -64.177 },
      { lat: -64.897, lon: -63.628 },
      { lat: -64.642, lon: -63.001 },
      { lat: -64.584, lon: -62.042 },
      { lat: -64.270, lon: -61.415 },
      { lat: -64.074, lon: -60.710 },
      { lat: -63.957, lon: -59.887 },
      { lat: -63.702, lon: -59.163 },
      { lat: -63.388, lon: -58.595 },
      { lat: -63.271, lon: -57.811 },
      { lat: -63.525, lon: -57.224 },
      { lat: -63.859, lon: -57.596 },
      { lat: -64.152, lon: -58.614 }
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

    // 2. Draw Sea Ice Heatmap Layer (Geographic Grid — zoom-adaptive resolution)
    if (showHeatmap) {
      const confidenceAlpha = Math.max(0.3, (95 - (forecastDay * (30 / 7))) / 100);

      // Scale grid resolution with zoom for clearer detail
      const latStep = viewport.zoom > 2.5 ? 0.5 : viewport.zoom > 1.5 ? 1.0 : 1.5;
      const lonStep = viewport.zoom > 2.5 ? 1.0 : viewport.zoom > 1.5 ? 2.0 : 3.0;

      for (let lat = -46; lat >= -82; lat -= latStep) {
        for (let lon = -180; lon <= 180; lon += lonStep) {
          const center = latLonToCanvas(lat, lon, width, height, viewport);
          
          // Frustum cull: skip cells outside the visible canvas with margin
          if (center.x < -50 || center.x > width + 50 || center.y < -50 || center.y > height + 50) continue;
          
          // Check if cell is over land, skip if so
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

          // Project 4 corners (slightly expanded to avoid checkerboard gaps)
          const overlap = 0.1;
          const p1 = latLonToCanvas(lat + latStep / 2 + overlap, lon - lonStep / 2 - overlap, width, height, viewport);
          const p2 = latLonToCanvas(lat + latStep / 2 + overlap, lon + lonStep / 2 + overlap, width, height, viewport);
          const p3 = latLonToCanvas(lat - latStep / 2 - overlap, lon + lonStep / 2 + overlap, width, height, viewport);
          const p4 = latLonToCanvas(lat - latStep / 2 - overlap, lon - lonStep / 2 - overlap, width, height, viewport);

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

    // 3. Draw Antarctic Continent Silhouette
    ctx.fillStyle = '#f0f4f8';
    ctx.fill(continentPath);
    ctx.strokeStyle = 'rgba(100, 140, 180, 0.5)';
    ctx.lineWidth = Math.max(1, 1.5 / viewport.zoom);
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
        ctx.lineWidth = isSelected ? Math.max(2, 2.5 / Math.sqrt(viewport.zoom)) : 1;
      } else if (route.id === 'SHORTEST_DISTANCE') {
        ctx.strokeStyle = isSelected ? 'rgba(255, 75, 92, 0.8)' : 'rgba(255, 75, 92, 0.15)';
        ctx.lineWidth = isSelected ? Math.max(1.5, 2 / Math.sqrt(viewport.zoom)) : 1;
      } else {
        ctx.strokeStyle = isSelected ? 'rgba(255, 183, 3, 0.8)' : 'rgba(255, 183, 3, 0.15)';
        ctx.lineWidth = isSelected ? Math.max(1.5, 2 / Math.sqrt(viewport.zoom)) : 1;
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

    // 5. Draw Vessel Progress Trail + Position
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

      // Draw traversed trail (bright solid cyan for completed portion)
      if (currIdx > 0) {
        ctx.beginPath();
        const firstWp = activeRoute.waypoints[0];
        const firstPt = latLonToCanvas(firstWp.lat, firstWp.lon, width, height, viewport);
        ctx.moveTo(firstPt.x, firstPt.y);
        for (let ti = 1; ti <= currIdx; ti++) {
          const twp = activeRoute.waypoints[ti];
          const tpt = latLonToCanvas(twp.lat, twp.lon, width, height, viewport);
          ctx.lineTo(tpt.x, tpt.y);
        }
        ctx.lineTo(vx, vy);
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.7)';
        ctx.lineWidth = 3.5 / viewport.zoom;
        ctx.setLineDash([]);
        ctx.stroke();
      }

      // Draw remaining route (dimmer dashed)
      if (currIdx < activeRoute.waypoints.length - 1) {
        ctx.beginPath();
        ctx.moveTo(vx, vy);
        for (let ri = nextIdx; ri < activeRoute.waypoints.length; ri++) {
          const rwp = activeRoute.waypoints[ri];
          const rpt = latLonToCanvas(rwp.lat, rwp.lon, width, height, viewport);
          ctx.lineTo(rpt.x, rpt.y);
        }
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.25)';
        ctx.lineWidth = 2 / viewport.zoom;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw ship position dot
      ctx.beginPath();
      ctx.arc(vx, vy, 5, 0, 2 * Math.PI);
      ctx.fillStyle = vesselProgress >= 1.0 ? '#38ef7d' : '#00f2fe';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Outer glow ring
      ctx.beginPath();
      ctx.arc(vx, vy, 10, 0, 2 * Math.PI);
      ctx.strokeStyle = vesselProgress >= 1.0 ? 'rgba(56, 239, 125, 0.3)' : 'rgba(0, 242, 254, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      labelsToDraw.push({
        text: vesselProgress >= 1.0 ? 'ARRIVED' : 'R/V BHARATI',
        tx: vx + 10,
        ty: vy + 4,
        color: vesselProgress >= 1.0 ? '#38ef7d' : '#38ef7d',
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
        const baseSize = Math.max(5, Math.min(14, iceberg.lengthKm / 3));
        const size = baseSize * Math.min(1.5, Math.max(0.8, viewport.zoom / 1.4));
        ctx.rect(x - size / 2, y - size / 2, size, size);
        
        // Color-code by hazard level
        const hazardColors: Record<string, { fill: string, stroke: string }> = {
          CRITICAL: { fill: 'rgba(255, 75, 92, 0.85)', stroke: '#ff4b5c' },
          HIGH: { fill: 'rgba(255, 140, 50, 0.7)', stroke: '#ff8c32' },
          MODERATE: { fill: 'rgba(255, 200, 50, 0.5)', stroke: '#ffc832' },
          LOW: { fill: 'rgba(180, 210, 240, 0.3)', stroke: 'rgba(180, 210, 240, 0.5)' }
        };
        const colors = hazardColors[iceberg.hazardLevel] || hazardColors.LOW;
        ctx.fillStyle = isSelected ? 'rgba(255, 183, 3, 0.9)' : colors.fill;
        ctx.fill();

        ctx.strokeStyle = isSelected ? '#ffb703' : colors.stroke;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Show label when zoomed in or for important icebergs
        const showLabel = isSelected || iceberg.hazardLevel === 'CRITICAL' || 
          (iceberg.hazardLevel === 'HIGH' && viewport.zoom > 1.2) || 
          viewport.zoom > 2.0;
        if (showLabel) {
          const labelText = iceberg.id;
          labelsToDraw.push({
            text: labelText,
            tx: x + size + 4,
            ty: y + 3,
            color: isSelected ? '#ffb703' : (iceberg.hazardLevel === 'CRITICAL' ? '#ff4b5c' : '#c0cfe0'),
            font: '9px Inter'
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
          <div className="map-card-title">Active AI Route</div>
          <div className="map-card-value" style={{ color: '#00f2fe' }}>
            {activeRoute?.title}
          </div>
        </div>
      </div>


      {/* Viewport Controls Overlay */}
      <div style={{ position: 'absolute', bottom: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 10 }}>
        <button 
          className="btn-header" 
          onClick={handleZoomIn} 
          title="Zoom In"
          style={{ padding: '8px', background: 'rgba(5, 11, 20, 0.85)', borderRadius: '8px', border: '1px solid var(--border-glass)', cursor: 'pointer' }}
        >
          <ZoomIn size={18} color="#00f2fe" />
        </button>
        
        <button 
          className="btn-header" 
          onClick={handleZoomOut} 
          title="Zoom Out"
          style={{ padding: '8px', background: 'rgba(5, 11, 20, 0.85)', borderRadius: '8px', border: '1px solid var(--border-glass)', cursor: 'pointer' }}
        >
          <ZoomOut size={18} color="#00f2fe" />
        </button>
        
        <button 
          className="btn-header" 
          onClick={fitToActiveRoute} 
          title="Reset View & Recenter Route"
          style={{ padding: '8px', background: 'rgba(5, 11, 20, 0.85)', borderRadius: '8px', border: hasManualOverride ? '1px solid #ffb703' : '1px solid rgba(0, 242, 254, 0.4)', cursor: 'pointer' }}
        >
          <RotateCcw size={18} color={hasManualOverride ? "#ffb703" : "#00f2fe"} />
        </button>

        <button 
          className="btn-header" 
          onClick={toggleFullscreen} 
          title="Toggle Fullscreen"
          style={{ padding: '8px', background: 'rgba(5, 11, 20, 0.85)', borderRadius: '8px', border: isFullscreen ? '1px solid #38ef7d' : '1px solid rgba(0, 242, 254, 0.4)', cursor: 'pointer' }}
        >
          {isFullscreen ? (
            <Minimize2 size={18} color="#38ef7d" />
          ) : (
            <Maximize2 size={18} color="#00f2fe" />
          )}
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
      {/* Live Vessel Navigation Marker with Lucide Ship Icon */}
      {vesselNavInfo && (
        <div 
          className="live-ship-overlay" 
          style={{
            position: 'absolute',
            left: vesselNavInfo.x,
            top: vesselNavInfo.y,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 35
          }}
        >
          {/* Radar Pulse Ring */}
          <div className={`vessel-pulse-ring ${vesselNavInfo.arrived ? 'arrived' : ''}`} />
          
          {/* Forward Heading Beam Cone */}
          {!vesselNavInfo.arrived && (
            <div 
              className="vessel-heading-cone" 
              style={{ transform: `rotate(${vesselNavInfo.headingDeg}deg)` }} 
            />
          )}

          {/* Lucide Ship Icon */}
          <div 
            className="vessel-icon-wrapper"
            style={{ transform: vesselNavInfo.arrived ? 'none' : `rotate(${vesselNavInfo.headingDeg}deg)` }}
          >
            <Ship size={20} color={vesselNavInfo.arrived ? '#38ef7d' : '#00f2fe'} fill={vesselNavInfo.arrived ? 'rgba(56, 239, 125, 0.25)' : 'rgba(0, 242, 254, 0.25)'} />
          </div>

          {/* Live Telemetry Badge */}
          <div className="vessel-hud-badge">
            <div className="vessel-title">
              <span className={`vessel-dot ${vesselNavInfo.arrived ? 'arrived' : ''}`} /> R/V {vesselNavInfo.vesselName} [{vesselNavInfo.polarClass}]
            </div>
            <div className="vessel-stats">
              {vesselNavInfo.arrived ? (
                <>
                  <span style={{ color: '#38ef7d', fontWeight: 700 }}>✓ ARRIVED</span> • 
                  <span>{vesselNavInfo.progressPct}%</span>
                </>
              ) : (
                <>
                  <span>{vesselNavInfo.speedKnots.toFixed(1)} kts</span> • 
                  <span>{vesselNavInfo.sicPct}% Ice</span> • 
                  <span>{vesselNavInfo.progressPct}%</span> • 
                  <span className="nav-tag">LIVE NAV</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
