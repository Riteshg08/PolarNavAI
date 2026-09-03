export interface DatasetMetadata {
  source: string;
  acquisitionTime: string;
  processingTime: string;
  geographicCoverage: string;
  spatialResolutionKm: number;
  temporalResolutionHours: number;
  status: 'MOCK' | 'CACHED' | 'LIVE';
}

export interface DataEnvelope<T> {
  metadata: DatasetMetadata;
  data: T;
}
