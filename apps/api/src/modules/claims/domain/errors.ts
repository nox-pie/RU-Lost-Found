import { ERROR_CODES } from '@ru-lost-found/shared';
import { ConflictError, ValidationError } from '../../../core/errors/AppError';

export class HandoverCodeIncorrectError extends ValidationError {
  override readonly code = ERROR_CODES.HANDOVER_CODE_INCORRECT;

  constructor(readonly attemptsLeft: number) {
    super(`That code is not right. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.`);
  }
}

/** Too many wrong codes: only security desk staff can confirm this handover now. */
export class HandoverLockedError extends ConflictError {
  override readonly code = ERROR_CODES.HANDOVER_LOCKED;

  constructor() {
    super(
      'Too many incorrect codes. Please meet at the security desk so staff can confirm the handover.',
    );
  }
}
