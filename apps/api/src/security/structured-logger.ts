import { ConsoleLogger, Injectable } from '@nestjs/common';
import { redactSensitive } from '@procurement/shared';

@Injectable()
export class StructuredLogger extends ConsoleLogger {
  protected stringifyMessage(message: unknown, logLevel: string): string {
    return JSON.stringify({ level: logLevel, message: redactSensitive(message), timestamp: new Date().toISOString() });
  }
}
