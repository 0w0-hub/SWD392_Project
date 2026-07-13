package com.swd392.onlineshopping.customeraccount.broker;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Cau hinh ket noi toi Broker (service registry).
 */
@ConfigurationProperties(prefix = "broker")
public class BrokerProperties {

    /** Tat di khi chay test hoac khi demo rieng mot minh service nay. */
    private boolean enabled = true;

    /** Dia chi Broker, vd: http://localhost:8080 */
    private String baseUrl = "http://localhost:8080";

    /** Ten service dang ky voi Broker - cac service khac tra cuu bang ten nay. */
    private String serviceName = "CustomerAccountService";

    /** Host ma cac service khac dung de goi nguoc lai service nay. */
    private String host = "localhost";

    /** Chu ky gui heartbeat bao "toi con song" cho Broker. */
    private Duration heartbeatInterval = Duration.ofSeconds(30);

    /** Timeout cho moi loi goi toi Broker - Broker cham khong duoc lam treo service nay. */
    private Duration timeout = Duration.ofSeconds(3);

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getServiceName() {
        return serviceName;
    }

    public void setServiceName(String serviceName) {
        this.serviceName = serviceName;
    }

    public String getHost() {
        return host;
    }

    public void setHost(String host) {
        this.host = host;
    }

    public Duration getHeartbeatInterval() {
        return heartbeatInterval;
    }

    public void setHeartbeatInterval(Duration heartbeatInterval) {
        this.heartbeatInterval = heartbeatInterval;
    }

    public Duration getTimeout() {
        return timeout;
    }

    public void setTimeout(Duration timeout) {
        this.timeout = timeout;
    }
}
