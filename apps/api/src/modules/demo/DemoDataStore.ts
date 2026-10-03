/** Finds and deletes everything that belongs to the demo accounts, across all collections. */
export interface DemoDataStore {
  /** Ids of the demo accounts (emails on the demo domain). */
  findDemoUserIds(): Promise<string[]>;
  /**
   * Deletes the demo accounts and everything tied to them: their posts and sessions, claims and
   * reports on those posts or by them, notifications and audit entries about any of it, and
   * pending events. Returns the uploaded photos (not the built-in sample photos) to delete from
   * storage, and how many records were removed per collection.
   */
  removeAll(userIds: readonly string[]): Promise<{
    photoIds: string[];
    removed: Record<string, number>;
  }>;
}
