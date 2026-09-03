import { VesselProfile } from '../../types';

// Vessel Profiles
export const VESSELS: VesselProfile[] = [
  {
    id: 'VESSEL_BHARATI',
    name: 'R/V Bharati Expedition Icebreaker',
    polarClass: 'PC3',
    lengthMeters: 135,
    beamMeters: 24,
    draftMeters: 8.5,
    maxSpeedKnots: 16.5,
    iceBreakingCapacityMeters: 1.8,
    baseFuelBurnTonsPerDay: 28.5
  },
  {
    id: 'ORV_SAGAR_KANYA',
    name: 'ORV Sagar Kanya (Modified Polar)',
    polarClass: 'PC5',
    lengthMeters: 100.3,
    beamMeters: 16.4,
    draftMeters: 5.6,
    maxSpeedKnots: 14.0,
    iceBreakingCapacityMeters: 1.0,
    baseFuelBurnTonsPerDay: 22.0
  },
  {
    id: 'POLAR_SUPPORTER',
    name: 'R/V Kronprins Haakon Class',
    polarClass: 'PC1',
    lengthMeters: 100,
    beamMeters: 21,
    draftMeters: 8.0,
    maxSpeedKnots: 15.0,
    iceBreakingCapacityMeters: 2.5,
    baseFuelBurnTonsPerDay: 32.0
  },
  {
    id: 'LIGHT_ICE_VESSEL',
    name: 'Polar Logistics Resupply Ship',
    polarClass: 'PC7',
    lengthMeters: 95,
    beamMeters: 15,
    draftMeters: 5.2,
    maxSpeedKnots: 13.5,
    iceBreakingCapacityMeters: 0.6,
    baseFuelBurnTonsPerDay: 18.0
  }
];
