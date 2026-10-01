import type { NotificationType } from '@ru-lost-found/shared';
import { AggregateRoot } from '../../../core/domain/AggregateRoot';

export interface NotificationProps {
  id: string;
  userId: string;
  universityId: string;
  type: NotificationType;
  title: string;
  body: string;
  claimId: string | null;
  itemId: string | null;
  /** The domain event that caused it; with `userId`, unique, so a retried event can't notify twice. */
  sourceEventId: string;
  readAt: Date | null;
  createdAt: Date;
  version: number;
}

/** An in-app message shown in the user's notification list. */
export class Notification extends AggregateRoot {
  private constructor(private readonly props: NotificationProps) {
    super(props.id, props.version);
  }

  static create(input: Omit<NotificationProps, 'readAt' | 'version'>): Notification {
    return new Notification({ ...input, readAt: null, version: 0 });
  }

  static restore(props: NotificationProps): Notification {
    return new Notification(props);
  }

  get userId() {
    return this.props.userId;
  }
  get universityId() {
    return this.props.universityId;
  }
  get type() {
    return this.props.type;
  }
  get title() {
    return this.props.title;
  }
  get body() {
    return this.props.body;
  }
  get claimId() {
    return this.props.claimId;
  }
  get itemId() {
    return this.props.itemId;
  }
  get sourceEventId() {
    return this.props.sourceEventId;
  }
  get readAt() {
    return this.props.readAt;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get isRead() {
    return this.props.readAt !== null;
  }
}
