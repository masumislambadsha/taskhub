import type { TestProject } from "vitest/node";
import { MongoMemoryReplSet } from "mongodb-memory-server";

declare module "vitest" {
  export interface ProvidedContext {
    /** Connection string of the MongoDB replica set shared by all test files. */
    mongoUri: string;
  }
}

/**
 * Starts one in-memory MongoDB replica set for the whole test run and hands its
 * URI to the test files (`inject("mongoUri")`, used by `startTestDb`). Starting
 * a server per file made several mongod processes launch at once, which could
 * pass the launch timeout on a small CI runner.
 *
 * If `MONGODB_TEST_URI` is set, nothing is started and that URI is used.
 */
export default async function setup(project: TestProject) {
  const external = process.env.MONGODB_TEST_URI;
  if (external) {
    project.provide("mongoUri", external);
    return;
  }

  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    // The default is 10 s, which is too short when the machine is busy.
    instanceOpts: [{ launchTimeout: 60_000 }],
  });
  project.provide("mongoUri", replSet.getUri());

  return async () => {
    await replSet.stop();
  };
}
