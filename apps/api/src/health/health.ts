import { Controller, Get } from '@nestjs/common';
@Controller({ path: 'health', version: '1' })
export class HealthController { @Get() health() { return { status: 'ok' }; } @Get('database') database() { return { status: 'ok', dependency: 'postgresql' }; } @Get('redis') redis() { return { status: 'ok', dependency: 'redis' }; } }
