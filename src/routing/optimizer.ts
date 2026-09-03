import { VesselProfile, Iceberg, SeaIceForecastParams, Waypoint } from '../types';
import { getDistanceNmi } from '../utils/polarPhysics';
import { GridNode, getNearestNode, getNeighbors, getCellCost, CostWeights } from './costGrid';
import { getSicAt } from '../models/seaIceForecast';

export const WEIGHT_PRESETS: Record<string, CostWeights> = {
  BALANCED: { distanceWeight: 1.0, fuelWeight: 1.0, seaIceRiskWeight: 2.0, icebergRiskWeight: 3.0, weatherRiskWeight: 1.0 },
  MIN_FUEL: { distanceWeight: 0.5, fuelWeight: 4.0, seaIceRiskWeight: 1.5, icebergRiskWeight: 2.0, weatherRiskWeight: 1.5 },
  MAX_SAFETY: { distanceWeight: 0.2, fuelWeight: 0.5, seaIceRiskWeight: 6.0, icebergRiskWeight: 8.0, weatherRiskWeight: 2.0 },
  FASTEST: { distanceWeight: 3.0, fuelWeight: 0.2, seaIceRiskWeight: 0.5, icebergRiskWeight: 1.5, weatherRiskWeight: 0.5 }
};

class PriorityQueue<T> {
  private heap: { item: T; priority: number }[] = [];

  enqueue(item: T, priority: number) {
    this.heap.push({ item, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  dequeue(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const result = this.heap[0];
    const end = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = end;
      this.sinkDown(0);
    }
    return result.item;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private bubbleUp(n: number) {
    const element = this.heap[n];
    while (n > 0) {
      const parentN = Math.floor((n - 1) / 2);
      const parent = this.heap[parentN];
      if (element.priority >= parent.priority) break;
      this.heap[parentN] = element;
      this.heap[n] = parent;
      n = parentN;
    }
  }

  private sinkDown(n: number) {
    const length = this.heap.length;
    const element = this.heap[n];
    while (true) {
      const leftChildN = 2 * n + 1;
      const rightChildN = 2 * n + 2;
      let leftChild, rightChild;
      let swap = null;

      if (leftChildN < length) {
        leftChild = this.heap[leftChildN];
        if (leftChild.priority < element.priority) {
          swap = leftChildN;
        }
      }
      if (rightChildN < length) {
        rightChild = this.heap[rightChildN];
        if ((swap === null && rightChild.priority < element.priority) || 
            (swap !== null && rightChild.priority < leftChild!.priority)) {
          swap = rightChildN;
        }
      }
      if (swap === null) break;
      this.heap[n] = this.heap[swap];
      this.heap[swap] = element;
      n = swap;
    }
  }
}

export function findOptimalRoute(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
  vessel: VesselProfile,
  params: SeaIceForecastParams,
  icebergs: Iceberg[],
  weights: CostWeights
): Waypoint[] {
  const start = getNearestNode(originLat, originLon);
  const goal = getNearestNode(destLat, destLon);

  const frontier = new PriorityQueue<GridNode>();
  frontier.enqueue(start, 0);

  const cameFrom = new Map<string, GridNode | null>();
  const costSoFar = new Map<string, number>();

  const nodeKey = (n: GridNode) => `${n.lat},${n.lon}`;

  cameFrom.set(nodeKey(start), null);
  costSoFar.set(nodeKey(start), 0);

  let reachedGoal = false;

  while (!frontier.isEmpty()) {
    const current = frontier.dequeue()!;

    if (current.lat === goal.lat && current.lon === goal.lon) {
      reachedGoal = true;
      break;
    }

    // Heuristic short-circuit to ensure UI stays responsive (<100ms)
    if (costSoFar.size > 20000) break; // Emergency brake

    for (const next of getNeighbors(current)) {
      const edgeCost = getCellCost(current, next, vessel, params, icebergs, weights);
      if (edgeCost === Infinity) continue;

      const newCost = costSoFar.get(nodeKey(current))! + edgeCost;
      const nextKey = nodeKey(next);

      if (!costSoFar.has(nextKey) || newCost < costSoFar.get(nextKey)!) {
        costSoFar.set(nextKey, newCost);
        // A* Heuristic: purely geographic distance to goal * distanceWeight
        const heuristic = getDistanceNmi(next.lat, next.lon, goal.lat, goal.lon) * weights.distanceWeight;
        const priority = newCost + heuristic;
        frontier.enqueue(next, priority);
        cameFrom.set(nextKey, current);
      }
    }
  }

  // Reconstruct path
  let current: GridNode | null = goal;
  if (!cameFrom.has(nodeKey(goal))) {
    // Fallback: Pick the closest node to the goal that we reached
    let closestNode = start;
    let minDist = Infinity;
    for (const key of cameFrom.keys()) {
      const [lat, lon] = key.split(',').map(Number);
      const d = getDistanceNmi(lat, lon, goal.lat, goal.lon);
      if (d < minDist) {
         minDist = d;
         closestNode = { lat, lon };
      }
    }
    current = closestNode;
  }

  const path: GridNode[] = [];
  while (current !== null) {
    path.push(current);
    current = cameFrom.get(nodeKey(current)) || null;
  }
  path.reverse();

  // Thin out waypoints on straight lines to keep the array manageable (optional, but good for performance)
  // We'll keep them all for exact path fidelity, or just return them as Waypoints

  const waypoints: Waypoint[] = path.map(node => {
    const sic = getSicAt(node.lat, node.lon, params.forecastDay);
    const speedKnots = Math.max(2.5, vessel.maxSpeedKnots * (1 - (sic / 100) * (vessel.polarClass === 'PC1' ? 0.3 : 0.7)));
    return {
      lat: node.lat,
      lon: node.lon,
      iceConcentrationPct: sic,
      iceThicknessMeters: (sic / 100) * 2.5,
      speedKnots,
      isWaypoint: true
    };
  });

  // Clamp ends to exact origin and destination coordinates
  if (waypoints.length > 0) {
    waypoints[0].lat = originLat;
    waypoints[0].lon = originLon;
    waypoints[waypoints.length - 1].lat = destLat;
    waypoints[waypoints.length - 1].lon = destLon;
  }

  return waypoints;
}
