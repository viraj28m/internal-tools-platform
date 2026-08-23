import featureFlags from './feature_flags';
import kycCases from './kyc_cases';
import refundsConfig from './refunds';
import type { ResourceConfig } from './types';

export const resourceConfigs = {
  kyc_cases: kycCases,
  refunds: refundsConfig,
  feature_flags: featureFlags,
} as const;

export type ResourceName = keyof typeof resourceConfigs;

export function getResourceConfig(resource: ResourceName): ResourceConfig {
  return resourceConfigs[resource];
}

export type { ResourceConfig, TransitionConfig } from './types';
