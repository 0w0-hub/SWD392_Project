package com.swd392.onlineshopping.broker.registry;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Registry luu trong bo nho: serviceId -> ServiceInstance.
 *
 * <p>Khong dung database. Registry la trang thai <b>phu sinh</b>: nguon su that la chinh cac
 * service dang chay. Neu Broker restart, cac service se tu dang ky lai o chu ky heartbeat ke
 * tiep, nen viec luu xuong dia khong mang lai gi ma con co nguy co giu lai ban ghi cu da chet.
 */
@Component
public class ServiceRegistry {

    private static final Logger log = LoggerFactory.getLogger(ServiceRegistry.class);

    private final Map<String, ServiceInstance> instances = new ConcurrentHashMap<>();
    private final RegistryProperties properties;

    public ServiceRegistry(RegistryProperties properties) {
        this.properties = properties;
    }

    /** Dang ky moi, hoac ghi de neu serviceId da ton tai (service restart voi cung id). */
    public ServiceInstance register(ServiceRegistration registration) {
        ServiceInstance instance = new ServiceInstance(registration);
        ServiceInstance previous = instances.put(registration.serviceId(), instance);
        if (previous == null) {
            log.info("DANG KY   {} tai {} (serviceId={})",
                    registration.serviceName(), registration.baseUrl(), registration.serviceId());
        } else {
            log.info("DANG KY LAI {} tai {}", registration.serviceName(), registration.baseUrl());
        }
        return instance;
    }

    /**
     * Ghi nhan heartbeat.
     *
     * @return false neu Broker khong con biet serviceId nay (vd: Broker vua restart) - service
     *         se thay ket qua nay va tu dang ky lai.
     */
    public boolean heartbeat(String serviceId) {
        ServiceInstance instance = instances.get(serviceId);
        if (instance == null) {
            return false;
        }
        instance.touch();
        return true;
    }

    public boolean deregister(String serviceId) {
        ServiceInstance removed = instances.remove(serviceId);
        if (removed != null) {
            log.info("HUY DANG KY {} (serviceId={})", removed.getServiceName(), serviceId);
            return true;
        }
        return false;
    }

    /** Tra cuu theo ten service (white pages). */
    public List<ServiceInstance> findByName(String serviceName) {
        return instances.values().stream()
                .filter(i -> i.getServiceName().equalsIgnoreCase(serviceName))
                .toList();
    }

    /** Tra cuu theo nghiep vu ma service cung cap (yellow pages). */
    public List<ServiceInstance> findByOperation(String operation) {
        return instances.values().stream()
                .filter(i -> i.getOperations().stream().anyMatch(op -> op.equalsIgnoreCase(operation)))
                .toList();
    }

    public Optional<ServiceInstance> findById(String serviceId) {
        return Optional.ofNullable(instances.get(serviceId));
    }

    public List<ServiceInstance> findAll() {
        return instances.values().stream()
                .sorted(Comparator.comparing(ServiceInstance::getServiceName))
                .toList();
    }

    /**
     * Loai cac service da qua han heartbeat.
     *
     * <p>Can thiet vi service co the chet dot ngot (kill process, mat dien) ma khong kip goi
     * DELETE. Neu khong quet, Broker se tra ve dia chi cua mot service da chet va client se
     * goi vao khoang khong.
     */
    @Scheduled(fixedDelayString = "${registry.sweep-interval-seconds:30}", timeUnit = TimeUnit.SECONDS)
    public void evictExpired() {
        Instant now = Instant.now();
        long ttl = properties.getHeartbeatTtlSeconds();
        instances.values().removeIf(instance -> {
            if (instance.isExpired(now, ttl)) {
                log.warn("LOAI BO  {} (serviceId={}) - khong co heartbeat qua {}s",
                        instance.getServiceName(), instance.getServiceId(), ttl);
                return true;
            }
            return false;
        });
    }
}