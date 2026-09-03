import { solvePolarRoutes } from './src/utils/polarPhysics';
import { predictTrajectory } from './src/models/icebergDrift';
import { ICEBERGS } from './src/data/icebergs';
import { VESSELS } from './src/data/vessels';

const mockIcebergs = [...ICEBERGS];
const dynamicIcebergs = mockIcebergs.map(ib => ({
  ...ib,
  predictedTrajectory: predictTrajectory(ib, 7)
}));

function testScenario(vesselId: string, optimizationWeight: string, title: string) {
  const params: any = {
    forecastDay: 0,
    selectedVesselId: vesselId,
    originStationId: 'CAPE_TOWN',
    destinationStationId: 'BHARATI',
    optimizationWeight
  };

  const routes = solvePolarRoutes(params, dynamicIcebergs);
  console.log(`\n=== SCENARIO: ${title} (${vesselId} | ${optimizationWeight}) ===`);
  routes.forEach(r => {
    console.log(`\nROUTE: ${r.title}`);
    console.log(`EXPLANATION: ${r.dynamicExplanation}`);
  });
}

testScenario('VESSEL_BHARATI', 'BALANCED', 'Baseline PC3 Icebreaker');
testScenario('LIGHT_ICE_VESSEL', 'MIN_FUEL', 'Weak PC7 Resupply Ship (Min Fuel)');
testScenario('POLAR_SUPPORTER', 'MAX_SAFETY', 'Strong PC1 Heavy Icebreaker (Max Safety)');
