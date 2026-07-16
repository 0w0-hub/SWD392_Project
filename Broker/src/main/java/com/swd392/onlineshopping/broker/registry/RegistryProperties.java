package com.swd392.onlineshopping.broker.registry;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "registry")
public class RegistryProperties {

    /**
     * Khong nhan duoc heartbeat qua ngan nay (giay) thi coi service da chet va loai khoi
     * registry. Phai lon hon chu ky heartbeat cua service (mac dinh 30s) du xa de mot lan
     * heartbeat lo mat goi tin khong lam service bi loai oan.
     */
    private long heartbeatTtlSeconds = 90;

    /** Chu ky quet don cac service da chet (giay). */
    private long sweepIntervalSeconds = 30;

    public long getHeartbeatTtlSeconds() {
        return heartbeatTtlSeconds;
    }

    public void setHeartbeatTtlSeconds(long heartbeatTtlSeconds) {
        this.heartbeatTtlSeconds = heartbeatTtlSeconds;
    }

    public long getSweepIntervalSeconds() {
        return sweepIntervalSeconds;
    }

    public void setSweepIntervalSeconds(long sweepIntervalSeconds) {
        this.sweepIntervalSeconds = sweepIntervalSeconds;
    }
}