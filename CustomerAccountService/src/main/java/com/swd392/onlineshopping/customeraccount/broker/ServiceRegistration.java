package com.swd392.onlineshopping.customeraccount.broker;

import java.util.List;

/**
 * Ban ghi ma service gui len Broker khi dang ky (Service Registration pattern).
 *
 * <p>Day la hop dong chung cua ca nhom: CatalogService, InventoryService va
 * DeliveryOrderService cung dang ky bang dung cau truc nay.
 */
public record ServiceRegistration(
        String serviceId,
        String serviceName,
        String version,
        String host,
        int port,
        String baseUrl,
        String healthUrl,
        List<String> operations) {
}
