import type { ResourceConfig } from '@/config';

export type TransitionOption = {
  name: string;
  /** Why the button is disabled, or null when the move looks available. */
  disabledReason: string | null;
};

/**
 * Reflects — never enforces — what the DAL would allow: the same config rules
 * it checks, evaluated against the session's roles and the record's status.
 */
export function transitionOptions(
  config: ResourceConfig,
  status: string,
  roles: string[],
): TransitionOption[] {
  return Object.entries(config.transitions).map(([name, transition]) => {
    const roleAllowed = transition.allowedRoles.some((role) => roles.includes(role));
    if (!roleAllowed) {
      return {
        name,
        disabledReason: `Your role (${roles.join(', ') || 'none'}) may not ${name}; requires ${transition.allowedRoles.join(' or ')}`,
      };
    }
    if (!transition.from.includes(status)) {
      return {
        name,
        disabledReason: `Illegal from status '${status}'; ${name} requires ${transition.from.join(' or ')}`,
      };
    }
    return { name, disabledReason: null };
  });
}
