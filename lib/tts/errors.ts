export type DegradeTarget = 'natural' | 'browser';

export class DegradeError extends Error {
  constructor(
    readonly code: 'quota_natural' | 'trial_exhausted' | 'supplier' | 'missing_key' | 'unauthenticated',
    readonly to: DegradeTarget,
    message: string,
  ) {
    super(message);
    this.name = 'DegradeError';
  }
}

export function degradeFor(_code: DegradeError['code']): DegradeTarget {
  return 'browser';
}
