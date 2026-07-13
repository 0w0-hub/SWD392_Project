package com.swd392.onlineshopping.broker;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Broker - Online Shopping System (SWD392).
 *
 * <p>Broker dong vai tro <b>service registry</b> trong kien truc brokered: cac service tu
 * dang ky khi khoi dong (Service Registration pattern), va client tra cuu dia chi service
 * qua Broker thay vi hardcode URL.
 *
 * <p>Broker <b>khong</b> chuyen tiep loi goi nghiep vu. No chi tra ve dia chi, sau do client
 * goi thang service (white pages lookup). Nho vay Broker khong tro thanh nut co chai cua
 * moi request.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class BrokerApplication {

    public static void main(String[] args) {
        SpringApplication.run(BrokerApplication.class, args);
    }
}