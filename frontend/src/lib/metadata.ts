/** LookupResponse.metadata is an open object in the contract; read it defensively. */
import type { LookupResponse } from '../api/types';

export interface LookupMetadata {
  version?: string;
  datasetMode?: string;
  datasetLabel?: string;
  ruleModes: string[];
  runIds: string[];
  partialData: boolean;
  missingSourceIds: string[];
  unprocessedSourceIds: string[];
  fixtureCase?: string;
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
const text = (value: unknown): string | undefined => (typeof value === 'string' && value ? value : undefined);

export function readMetadata(lookup: LookupResponse): LookupMetadata {
  const metadata = lookup.metadata ?? {};
  const dataset = metadata.dataset && typeof metadata.dataset === 'object' ? (metadata.dataset as Record<string, unknown>) : {};
  return {
    version: text(metadata.version),
    datasetMode: text(dataset.mode),
    datasetLabel: text(dataset.label),
    ruleModes: strings(metadata.rule_modes),
    runIds: strings(metadata.extraction_run_ids),
    partialData: metadata.partial_data === true,
    missingSourceIds: strings(metadata.missing_source_ids),
    unprocessedSourceIds: strings(metadata.unprocessed_source_ids),
    fixtureCase: text(metadata.fixture_case),
  };
}

/** True when the payload itself says it is synthetic, whatever mode the UI is in. */
export function isSynthetic(metadata: LookupMetadata): boolean {
  return metadata.datasetMode === 'synthetic' || metadata.ruleModes.includes('synthetic');
}
