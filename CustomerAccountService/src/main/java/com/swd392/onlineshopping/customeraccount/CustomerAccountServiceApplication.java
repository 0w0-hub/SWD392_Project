package com.swd392.onlineshopping.customeraccount;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * CustomerAccountService - Online Shopping System (SWD392).
 *
 * <p>Theo Figure 22.10, service nay so huu hai entity Customer va CustomerAccount.
 * Theo Figure 22.11, day la mot lop &laquo;service&raquo; thuan tuy: no khong dieu phoi
 * ai ca, chi tra loi yeu cau den tu Customer Coordinator (tao/xem/sua tai khoan) va tu
 * Billing Coordinator (giu tien, tru tien, tra lai tien cho don hang).
 */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class CustomerAccountServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(CustomerAccountServiceApplication.class, args);
    }
}
