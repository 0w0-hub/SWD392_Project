package com.swd392.onlineshopping.customeraccount.broker;

/**
 * Mot ban ghi service ma Broker tra ve khi tra cuu.
 */
public record ServiceInstance(
        String serviceId,
        String serviceName,
        String baseUrl,
        String status) {
}
