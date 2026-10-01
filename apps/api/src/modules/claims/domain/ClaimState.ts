import type { ClaimStatus } from '@ru-lost-found/shared';
import { InvalidStateTransitionError } from '../../../core/errors/AppError';

/**
 * State pattern: each claim status is a class that decides which actions are legal
 * and which status each action leads to. The default for every action is "not allowed",
 * so a state only overrides the transitions it permits.
 *
 *   REQUESTED ── approve ──▶ APPROVED ── completeHandover ──▶ COMPLETED
 *       │ reject / cancel        │ cancel / expire
 *       ▼                        ▼
 *   REJECTED / CANCELLED     CANCELLED / EXPIRED
 */
export abstract class ClaimState {
  abstract readonly status: ClaimStatus;

  approve(): ClaimStatus {
    throw this.notAllowed('approved');
  }

  reject(): ClaimStatus {
    throw this.notAllowed('rejected');
  }

  cancel(): ClaimStatus {
    throw this.notAllowed('cancelled');
  }

  completeHandover(): ClaimStatus {
    throw this.notAllowed('completed');
  }

  expire(): ClaimStatus {
    throw this.notAllowed('expired');
  }

  get isActive(): boolean {
    return false;
  }

  private notAllowed(action: string): InvalidStateTransitionError {
    return new InvalidStateTransitionError(
      `This claim cannot be ${action} because it is ${this.status.toLowerCase()}.`,
    );
  }
}

class RequestedState extends ClaimState {
  readonly status = 'REQUESTED' as const;

  override approve(): ClaimStatus {
    return 'APPROVED';
  }

  override reject(): ClaimStatus {
    return 'REJECTED';
  }

  override cancel(): ClaimStatus {
    return 'CANCELLED';
  }

  override get isActive(): boolean {
    return true;
  }
}

class ApprovedState extends ClaimState {
  readonly status = 'APPROVED' as const;

  override cancel(): ClaimStatus {
    return 'CANCELLED';
  }

  override completeHandover(): ClaimStatus {
    return 'COMPLETED';
  }

  override expire(): ClaimStatus {
    return 'EXPIRED';
  }

  override get isActive(): boolean {
    return true;
  }
}

/** REJECTED, CANCELLED, EXPIRED and COMPLETED: no further transitions. */
class TerminalState extends ClaimState {
  constructor(readonly status: ClaimStatus) {
    super();
  }
}

const STATES: Record<ClaimStatus, ClaimState> = {
  REQUESTED: new RequestedState(),
  APPROVED: new ApprovedState(),
  REJECTED: new TerminalState('REJECTED'),
  CANCELLED: new TerminalState('CANCELLED'),
  EXPIRED: new TerminalState('EXPIRED'),
  COMPLETED: new TerminalState('COMPLETED'),
};

/** States hold no per-claim data, so one shared instance per status is enough (Flyweight). */
export function claimStateFor(status: ClaimStatus): ClaimState {
  return STATES[status];
}
