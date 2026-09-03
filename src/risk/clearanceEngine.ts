import { RouteOption, Iceberg, RouteClearanceResult, SegmentClearance } from '../types';
import { getDistanceNmi } from '../utils/polarPhysics';

export const CLEARANCE_SAFE_MIN_NMI = 15;
export const CLEARANCE_WARNING_MIN_NMI = 5;

// Interpolate iceberg position for a given day fractional value
function getInterpolatedIcebergPos(iceberg: Iceberg, dayFloat: number): { lat: number; lon: number } {
  const trajectory = iceberg.predictedTrajectory || iceberg.trajectory7Day;
  if (!trajectory || trajectory.length === 0) return { lat: iceberg.lat, lon: iceberg.lon };

  if (dayFloat <= 0) return { lat: trajectory[0].lat, lon: trajectory[0].lon };
  if (dayFloat >= trajectory[trajectory.length - 1].day) {
    return { lat: trajectory[trajectory.length - 1].lat, lon: trajectory[trajectory.length - 1].lon };
  }

  const floorIdx = Math.floor(dayFloat);
  const ceilIdx = Math.ceil(dayFloat);
  if (floorIdx === ceilIdx) return { lat: trajectory[floorIdx].lat, lon: trajectory[floorIdx].lon };

  const p1 = trajectory[floorIdx];
  const p2 = trajectory[ceilIdx];
  const t = dayFloat - floorIdx;

  return {
    lat: p1.lat + t * (p2.lat - p1.lat),
    lon: p1.lon + t * (p2.lon - p1.lon),
    uncertaintyRadiusKm: p1.uncertaintyRadiusKm + t * (p2.uncertaintyRadiusKm - p1.uncertaintyRadiusKm)
  };
}

export function evaluateRouteClearance(route: RouteOption, icebergs: Iceberg[]): RouteClearanceResult {
  const segments: SegmentClearance[] = [];
  let overallStatus: 'SAFE' | 'WARNING' | 'DANGER' = 'SAFE';
  let minSeparationNmi = Infinity;
  let closestIceberg = undefined;

  for (let i = 0; i < route.waypoints.length - 1; i++) {
    const wp1 = route.waypoints[i];
    const wp2 = route.waypoints[i + 1];
    
    // We check the midpoint of the segment for a finer temporal resolution, using average time
    const timeHoursStart = wp1.estimatedTimeHours || 0;
    const timeHoursEnd = wp2.estimatedTimeHours || 0;
    const timeHours = (timeHoursStart + timeHoursEnd) / 2;
    const dayFloat = timeHours / 24;

    const vesselLat = (wp1.lat + wp2.lat) / 2;
    const vesselLon = (wp1.lon + wp2.lon) / 2;

    for (const iceberg of icebergs) {
      const icePos = getInterpolatedIcebergPos(iceberg, dayFloat);
      const distNmi = getDistanceNmi(vesselLat, vesselLon, icePos.lat, icePos.lon);
      const uncertaintyNmi = (icePos.uncertaintyRadiusKm || 0) / 1.852;
      
      // Effective distance is the distance minus the iceberg's positional uncertainty
      const effectiveDistNmi = Math.max(0, distNmi - uncertaintyNmi);

      if (effectiveDistNmi < minSeparationNmi) {
        minSeparationNmi = effectiveDistNmi;
        closestIceberg = iceberg.name;
      }

      let status: 'SAFE' | 'WARNING' | 'DANGER' = 'SAFE';
      if (effectiveDistNmi < CLEARANCE_WARNING_MIN_NMI) status = 'DANGER';
      else if (effectiveDistNmi < CLEARANCE_SAFE_MIN_NMI) status = 'WARNING';

      if (status !== 'SAFE') {
        segments.push({
          segmentIndex: i,
          startWaypointName: wp1.name,
          endWaypointName: wp2.name,
          vesselLat,
          vesselLon,
          icebergId: iceberg.id,
          icebergName: iceberg.name,
          icebergLat: icePos.lat,
          icebergLon: icePos.lon,
          icebergUncertaintyNmi: uncertaintyNmi,
          timeHours,
          separationDistanceNmi: distNmi,
          requiredClearanceNmi: CLEARANCE_SAFE_MIN_NMI,
          status,
          message: `Segment ${i}-${i+1} passes within ${effectiveDistNmi.toFixed(1)} nmi (accounting for ${uncertaintyNmi.toFixed(1)} nmi uncertainty) of ${iceberg.name} at approx T+${Math.round(timeHours)}h.`
        });

        if (status === 'DANGER') overallStatus = 'DANGER';
        else if (status === 'WARNING' && overallStatus !== 'DANGER') overallStatus = 'WARNING';
      }
    }
  }

  // De-duplicate segments to avoid spamming the UI if an iceberg is close for multiple segments
  const uniqueSegments = segments.filter((v, i, a) => a.findIndex(t => (t.icebergId === v.icebergId)) === i);

  return {
    overallStatus,
    segments: uniqueSegments,
    minSeparationNmi,
    closestIceberg
  };
}
