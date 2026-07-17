import { BrokerRegistrationService } from './broker-registration.service';

describe('BrokerRegistrationService', () => {
  const originalEnvironment = { ...process.env };
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.BROKER_ENABLED = 'true';
    process.env.BROKER_URL = 'http://broker.test:8080/';
    process.env.SERVICE_ID = 'delivery-test-1';
    process.env.SERVICE_HOST = 'delivery.test';
    process.env.SERVICE_BASE_URL = 'http://delivery.test:3001/';
    process.env.PORT = '3001';
    process.env.npm_package_version = '0.0.1-test';
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    process.env = { ...originalEnvironment };
  });

  it('registers the Delivery Order operations and deregisters on shutdown', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 201 }));
    const service = new BrokerRegistrationService();

    await service.onApplicationBootstrap();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'http://broker.test:8080/registry/services',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'delivery-test-1',
          serviceName: 'DeliveryOrderService',
          version: '0.0.1-test',
          host: 'delivery.test',
          port: 3001,
          baseUrl: 'http://delivery.test:3001',
          healthUrl: 'http://delivery.test:3001/health',
          operations: [
            'store',
            'select',
            'update',
            'orderShipped',
            'confirmPayment',
            'read',
            'requestInvoice',
            'prepareToCommitOrder',
            'commit',
            'abort',
          ],
        }),
      }),
    );

    await service.onApplicationShutdown();

    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'http://broker.test:8080/registry/services/delivery-test-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('re-registers when a heartbeat reports that the Broker forgot it', async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValue(new Response(null, { status: 201 }));
    const service = new BrokerRegistrationService();

    await service.onApplicationBootstrap();
    await (service as unknown as { heartbeat(): Promise<void> }).heartbeat();

    expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual([
      'http://broker.test:8080/registry/services',
      'http://broker.test:8080/registry/services/delivery-test-1/heartbeat',
      'http://broker.test:8080/registry/services',
    ]);

    await service.onApplicationShutdown();
  });

  it('keeps the service available when the Broker is offline', async () => {
    fetchSpy.mockRejectedValue(new Error('connection refused'));
    const service = new BrokerRegistrationService();

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    await service.onApplicationShutdown();
  });
});
