package com.swd392.onlineshopping.customeraccount.broker;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Cong giao tiep duy nhat voi Broker.
 *
 * <p>Hop dong REST cua Broker (thong nhat cho ca nhom):
 * <pre>
 *   POST   /registry/services                       dang ky, body = ServiceRegistration
 *   PUT    /registry/services/{serviceId}/heartbeat
 *   DELETE /registry/services/{serviceId}           huy dang ky
 *   GET    /registry/services/{serviceName}         tra cuu -> [ServiceInstance]
 * </pre>
 *
 * <p>Moi loi goi deu co timeout va khong nem exception ra ngoai: Broker chet thi
 * CustomerAccountService van phuc vu binh thuong cac API cua no.
 */
@Component
public class BrokerClient {

    private static final Logger log = LoggerFactory.getLogger(BrokerClient.class);

    private final RestClient restClient;

    public BrokerClient(BrokerProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(properties.getTimeout());
        factory.setReadTimeout(properties.getTimeout());
        this.restClient = RestClient.builder()
                .baseUrl(properties.getBaseUrl())
                .requestFactory(factory)
                .build();
    }

    /** @return true neu dang ky thanh cong. */
    public boolean register(ServiceRegistration registration) {
        try {
            restClient.post()
                    .uri("/registry/services")
                    .body(registration)
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (RestClientException ex) {
            log.warn("Dang ky voi Broker that bai: {}", ex.getMessage());
            return false;
        }
    }

    /** @return true neu Broker con nhan dien duoc service nay. */
    public boolean heartbeat(String serviceId) {
        try {
            restClient.put()
                    .uri("/registry/services/{serviceId}/heartbeat", serviceId)
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (RestClientException ex) {
            log.warn("Heartbeat toi Broker that bai: {}", ex.getMessage());
            return false;
        }
    }

    public void deregister(String serviceId) {
        try {
            restClient.delete()
                    .uri("/registry/services/{serviceId}", serviceId)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Da huy dang ky khoi Broker: serviceId={}", serviceId);
        } catch (RestClientException ex) {
            log.warn("Huy dang ky khoi Broker that bai: {}", ex.getMessage());
        }
    }

    /**
     * Tra cuu dia chi cua mot service khac qua Broker,
     * vd: {@code lookup("CatalogService")} truoc khi goi API cua CatalogService.
     */
    public List<ServiceInstance> lookup(String serviceName) {
        try {
            ServiceInstance[] found = restClient.get()
                    .uri("/registry/services/{serviceName}", serviceName)
                    .retrieve()
                    .body(ServiceInstance[].class);
            return found == null ? List.of() : Arrays.asList(found);
        } catch (RestClientException ex) {
            log.warn("Tra cuu '{}' qua Broker that bai: {}", serviceName, ex.getMessage());
            return List.of();
        }
    }

    /** Lay baseUrl cua mot instance dang song cua service can goi. */
    public Optional<String> resolveBaseUrl(String serviceName) {
        return lookup(serviceName).stream()
                .filter(instance -> instance.status() == null || "UP".equalsIgnoreCase(instance.status()))
                .map(ServiceInstance::baseUrl)
                .findFirst();
    }
}
