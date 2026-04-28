// Tests for the processInBatches concurrency helper — imported from the shared
// weatherEngine module. Using the real export means changes to the function are
// caught by these tests (unlike the previous inline copy which was a dead clone).

import { processInBatches } from '../../src/utils/weatherEngine';

describe("processInBatches", () => {
  it("returns all results when all items succeed", async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await processInBatches(items, 10, async (n) => n * 2);

    expect(results).toHaveLength(5);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    const values = results
      .filter((r): r is PromiseFulfilledResult<number> => r.status === "fulfilled")
      .map((r) => r.value);
    expect(values).toEqual([2, 4, 6, 8, 10]);
  });

  it("returns empty array for empty input", async () => {
    const results = await processInBatches([], 5, async (n: number) => n);
    expect(results).toHaveLength(0);
  });

  it("handles fewer items than batchSize without error", async () => {
    const items = [1, 2];
    const results = await processInBatches(items, 10, async (n) => n * 3);

    expect(results).toHaveLength(2);
    const values = results
      .filter((r): r is PromiseFulfilledResult<number> => r.status === "fulfilled")
      .map((r) => r.value);
    expect(values).toEqual([3, 6]);
  });

  it("isolates failures — a failing item does not prevent others from running", async () => {
    const items = [1, 2, 3];
    const results = await processInBatches(items, 10, async (n) => {
      if (n === 2) throw new Error("item 2 failed");
      return n * 10;
    });

    expect(results).toHaveLength(3);
    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("rejected");
    expect(results[2].status).toBe("fulfilled");

    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<number> => r.status === "fulfilled"
    );
    expect(fulfilled.map((r) => r.value)).toEqual([10, 30]);
  });

  it("processes items across multiple batches and returns all results in order", async () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const results = await processInBatches(items, 3, async (n) => n);

    expect(results).toHaveLength(7);
    const values = results
      .filter((r): r is PromiseFulfilledResult<number> => r.status === "fulfilled")
      .map((r) => r.value);
    expect(values).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("a failure in one batch does not prevent the next batch from running", async () => {
    const processed: number[] = [];
    const items = [1, 2, 3, 4, 5];

    await processInBatches(items, 2, async (n) => {
      processed.push(n);
      if (n === 1) throw new Error("first item fails");
      return n;
    });

    // All 5 items must have been attempted regardless of early failures
    expect(processed.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it("respects batchSize — items are processed in correct batch groupings", async () => {
    const items = [1, 2, 3, 4, 5];

    // With batchSize=2 on 5 items: batches are [1,2], [3,4], [5]
    const results = await processInBatches(items, 2, async (n) => n);
    expect(results).toHaveLength(5);
  });

  it("works with batchSize of 1 (fully serial)", async () => {
    const order: number[] = [];
    const items = [3, 1, 2];

    await processInBatches(items, 1, async (n) => {
      order.push(n);
      return n;
    });

    expect(order).toEqual([3, 1, 2]);
  });
});
