declare module "luxon" {
  export class DateTime {
    static now(): DateTime;
    static utc(): DateTime;
    static fromISO(text: string, opts?: { zone?: string }): DateTime;
    static fromSeconds(seconds: number, opts?: { zone?: string }): DateTime;
    setZone(zone: string): DateTime;
    set(values: Partial<{ hour: number; minute: number; second: number; millisecond: number }>): DateTime;
    startOf(unit: string): DateTime;
    minus(duration: { minutes?: number; hours?: number; days?: number }): DateTime;
    plus(duration: { minutes?: number; hours?: number; days?: number }): DateTime;
    diff(other: DateTime, unit: string): { seconds: number };
    toISO(): string | null;
    toISODate(): string | null;
    toUTC(): DateTime;
    toString(): string;
    get weekday(): number;
    get hour(): number;
    get minute(): number;
    get isValid(): boolean;
  }
}

declare module "node-cron" {
  interface ScheduleOptions {
    timezone?: string;
  }

  export function schedule(expression: string, fn: () => void | Promise<void>, options?: ScheduleOptions): {
    start(): void;
    stop(): void;
    destroy(): void;
  };

  const _default: {
    schedule: typeof schedule;
  };

  export default _default;
}
