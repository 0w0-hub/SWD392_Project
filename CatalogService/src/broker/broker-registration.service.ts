import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';

interface ServiceRegistration {
  serviceId: string;
  serviceName: string;
  version: string;
  host: string;
  port: number;
  baseUrl: string;
  healthUrl: string;
  operations: string[];
}

@Injectable()
export class BrokerRegistrationService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(BrokerRegistrationService.name);
  private readonly enabled =
    process.env.BROKER_ENABLED !== 'false' && process.env.NODE_ENV !== 'test';
  private readonly brokerUrl = (
    process.env.BROKER_URL ?? 'http://localhost:8080'
  ).replace(/\/$/, '');
  private readonly heartbeatInterval = this.readPositiveInteger(
    process.env.BROKER_HEARTBEAT_INTERVAL_MS,
    30_000,
  );
  private readonly registration = this.createRegistration();
  private heartbeatTimer?: NodeJS.Timeout;
  private registered = false;

  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    await this.register();
    this.heartbeatTimer = setInterval(() => {
      void this.heartbeat();
    }, this.heartbeatInterval);
    this.heartbeatTimer.unref();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    if (!this.enabled || !this.registered) {
      return;
    }

    try {
      await fetch(
        `${this.brokerUrl}/registry/services/${encodeURIComponent(this.registration.serviceId)}`,
        { method: 'DELETE', signal: AbortSignal.timeout(2_000) },
      );
    } catch (error) {
      this.logger.warn(
        `Could not deregister from Broker: ${this.message(error)}`,
      );
    }
  }

  private async register(): Promise<void> {
    try {
      const response = await fetch(`${this.brokerUrl}/registry/services`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(this.registration),
        signal: AbortSignal.timeout(2_000),
      });

      this.registered = response.ok;
      if (!response.ok) {
        this.logger.warn(
          `Broker registration failed with HTTP ${response.status}; retrying on the next heartbeat`,
        );
      }
    } catch (error) {
      this.registered = false;
      this.logger.warn(
        `Broker is unavailable; Catalog API remains online and registration will retry: ${this.message(error)}`,
      );
    }
  }

  private async heartbeat(): Promise<void> {
    if (!this.registered) {
      await this.register();
      return;
    }

    try {
      const response = await fetch(
        `${this.brokerUrl}/registry/services/${encodeURIComponent(this.registration.serviceId)}/heartbeat`,
        { method: 'PUT', signal: AbortSignal.timeout(2_000) },
      );

      if (response.status === 404) {
        this.registered = false;
        await this.register();
      } else if (!response.ok) {
        this.logger.warn(
          `Broker heartbeat failed with HTTP ${response.status}`,
        );
      }
    } catch (error) {
      this.registered = false;
      this.logger.warn(`Broker heartbeat failed: ${this.message(error)}`);
    }
  }

  private createRegistration(): ServiceRegistration {
    const port = this.readPositiveInteger(process.env.PORT, 3000);
    const host = process.env.SERVICE_HOST ?? 'localhost';
    const baseUrl = (
      process.env.SERVICE_BASE_URL ?? `http://${host}:${port}`
    ).replace(/\/$/, '');

    return {
      serviceId: process.env.SERVICE_ID ?? `catalog-service-${process.pid}`,
      serviceName: 'CatalogService',
      version: process.env.npm_package_version ?? '0.0.1',
      host,
      port,
      baseUrl,
      healthUrl: `${baseUrl}/health`,
      operations: ['requestCatalog', 'requestSelection'],
    };
  }

  private readPositiveInteger(
    value: string | undefined,
    fallback: number,
  ): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
