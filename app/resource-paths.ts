/** Route prefix for each resource that has an app, for links and revalidation. */
const RESOURCE_PATHS: Record<string, string> = {
  kyc_cases: '/kyc',
  refunds: '/refunds',
};

export function resourcePath(resource: string): string | undefined {
  return RESOURCE_PATHS[resource];
}
