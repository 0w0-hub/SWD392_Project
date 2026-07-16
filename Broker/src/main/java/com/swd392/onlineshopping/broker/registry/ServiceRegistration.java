package com.swd392.onlineshopping.broker.registry;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * Ban ghi ma mot service gui len khi dang ky.
 *
 * <p>Hop dong nay phai khop voi lop {@code ServiceRegistration} ben phia cac service
 * (CustomerAccountService, CatalogService, InventoryService, DeliveryOrderService).
 */
public record ServiceRegistration(
        @NotBlank String serviceId,
        @NotBlank String serviceName,
        String version,
        @NotBlank String host,
        @NotNull Integer port,
        @NotBlank String baseUrl,
        String healthUrl,
        List<String> operations) {
}