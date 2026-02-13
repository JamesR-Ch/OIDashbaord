import { logger } from "./logger";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  opName: string,
  fn: () => Promise<T>,
  attempts: number,
  baseDelayMs: number
): Promise<T> {
  let lastError: unknown;

  for (let i = 1; i <= Math.max(1, attempts); i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i >= attempts) break;
      const delay = baseDelayMs * i;
      logger.warn({ opName, attempt: i, delayMs: delay, err: error }, "operation failed, retrying");
      await sleep(delay);
    }
  }

  throw lastError;
}
