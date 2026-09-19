export class DowngradeNotAllowedError extends Error {
  readonly code = 'downgrade_not_allowed';

  constructor(message = 'downgrade_not_allowed') {
    super(message);
    this.name = 'DowngradeNotAllowedError';
  }
}

export class NoActiveSubscriptionError extends Error {
  readonly code = 'no_active_subscription';

  constructor(message = 'no_active_subscription') {
    super(message);
    this.name = 'NoActiveSubscriptionError';
  }
}
