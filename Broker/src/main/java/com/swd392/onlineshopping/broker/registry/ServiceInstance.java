package com.swd392.onlineshopping.broker.registry;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.Instant;
import java.util.List;

/**
 * Mot service dang nam trong registry.
 *
 * <p>Doi tuong nay bi nhieu luong doc/ghi cung luc (service gui heartbeat, client tra cuu,
 * bo quet don service chet), nen {@code lastHeartbeat} phai la volatile.
 */
public class ServiceInstance {

    private final String serviceId;
    private final String serviceName;
    private final String version;
    private final String host;
    private final int port;
    private final String baseUrl;
    private final String healthUrl;
    private final List<String> operations;
    private final Instant registeredAt;

    private volatile Instant lastHeartbeat;

    public ServiceInstance(ServiceRegistration reg) {
        this.serviceId = reg.serviceId();
        this.serviceName = reg.serviceName();
        this.version = reg.version();
        this.host = reg.host();
        this.port = reg.port();
        this.baseUrl = reg.baseUrl();
        this.healthUrl = reg.healthUrl();
        this.operations = reg.operations() == null ? List.of() : List.copyOf(reg.operations());
        this.registeredAt = Instant.now();
        this.lastHeartbeat = Instant.now();
    }

    public void touch() {
        this.lastHeartbeat = Instant.now();
    }

    /** Qua han heartbeat -> coi nhu service da chet. */
    @JsonIgnore
    public boolean isExpired(Instant now, long ttlSeconds) {
        Instant deadline = lastHeartbeat.plusSeconds(ttlSeconds);
        return !deadline.isAfter(now);
    }

    /** Client chi goi cac instance co status UP. */
    public String getStatus() {
        return "UP";
    }

    public String getServiceId() {
        return serviceId;
    }

    public String getServiceName() {
        return serviceName;
    }

    public String getVersion() {
        return version;
    }

    public String getHost() {
        return host;
    }

    public int getPort() {
        return port;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public String getHealthUrl() {
        return healthUrl;
    }

    public List<String> getOperations() {
        return operations;
    }

    public Instant getRegisteredAt() {
        return registeredAt;
    }

    public Instant getLastHeartbeat() {
        return lastHeartbeat;
    }
}