import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';

let replSet: MongoMemoryReplSet | undefined;

/**
 * Starts one in-memory MongoDB for the whole test run. It is a single-node replica set
 * because multi-document transactions require one. Each test file uses its own database.
 */
export async function setup(project: TestProject): Promise<void> {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  project.provide('mongoUri', replSet.getUri());
}

export async function teardown(): Promise<void> {
  await replSet?.stop();
}

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
