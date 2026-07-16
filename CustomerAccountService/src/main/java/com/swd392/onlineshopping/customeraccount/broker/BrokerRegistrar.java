package com.swd392.onlineshopping.customeraccount.broker;

import jakarta.annotation.PreDestroy;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.web.context.WebServerInitializedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Vong doi dang ky cua CustomerAccountService voi Broker.
 *
 * <p>Web server san sang -> dang ky. Sau do cu moi chu ky lai gui heartbeat; neu Broker
 * bao loi (Broker vua restart, hoac luc khoi dong Broker chua bat) thi lan tick ke tiep
 * se tu dang ky lai. Khi service tat -> huy dang ky.
 */
@Component
@ConditionalOnProperty(prefix = "broker", name = "enabled", havingValue = "true", matchIfMissing = true)
public class BrokerRegistrar {

    private static final Logger log = LoggerFactory.getLogger(BrokerRegistrar.class);

    /** Cac nghiep vu service nay cung cap - Broker dung lam trang vang (yellow pages). */
    private static final List<String> OPERATIONS = List.of(
            "createCustomer", "getCustomer", "updateCustomer", "deactivateCustomer",
            "createAccount", "getAccount", "getAccountsByCustomer",
            "deposit", "withdraw", "refund",
            "placeHold", "captureHold", "releaseHold",
            "listTransactions");

    private final BrokerClient brokerClient;
    private final BrokerProperties properties;
    private final String serviceId = UUID.randomUUID().toString();
    private final AtomicBoolean registered = new AtomicBoolean(false);

    private volatile int port = -1;

    public BrokerRegistrar(BrokerClient brokerClient, BrokerProperties properties) {
        this.brokerClient = brokerClient;
        this.properties = properties;
    }

    /** Lay dung cong ma Tomcat that su dang lang nghe (ke ca khi cau hinh server.port=0). */
    @EventListener
    public void onWebServerReady(WebServerInitializedEvent event) {
        this.port = event.getWebServer().getPort();
        attemptRegister();
    }

    @Scheduled(fixedDelayString = "${broker.heartbeat-interval:30s}")
    public void heartbeat() {
        if (port < 0) {
            return;
        }
        if (!registered.get()) {
            attemptRegister();
            return;
        }
        if (!brokerClient.heartbeat(serviceId)) {
            // Broker khong con biet toi minh (vd: vua restart) -> dang ky lai o tick sau.
            registered.set(false);
        }
    }

    @PreDestroy
    public void deregister() {
        if (registered.compareAndSet(true, false)) {
            brokerClient.deregister(serviceId);
        }
    }

    private void attemptRegister() {
        String baseUrl = "http://" + properties.getHost() + ":" + port;
        ServiceRegistration registration = new ServiceRegistration(
                serviceId,
                properties.getServiceName(),
                "1.0",
                properties.getHost(),
                port,
                baseUrl,
                baseUrl + "/actuator/health",
                OPERATIONS);

        if (brokerClient.register(registration)) {
            registered.set(true);
            log.info("Da dang ky '{}' voi Broker tai {} (serviceId={}, baseUrl={})",
                    properties.getServiceName(), properties.getBaseUrl(), serviceId, baseUrl);
        } else {
            log.warn("Chua dang ky duoc voi Broker tai {}. Service van chay binh thuong, se thu lai sau {}.",
                    properties.getBaseUrl(), properties.getHeartbeatInterval());
        }
    }

    public boolean isRegistered() {
        return registered.get();
    }

    public String getServiceId() {
        return serviceId;
    }
}
