package com.swd392.onlineshopping.customeraccount.config;

import com.swd392.onlineshopping.customeraccount.repository.CustomerRepository;
import com.swd392.onlineshopping.customeraccount.service.AccountService;
import com.swd392.onlineshopping.customeraccount.service.CustomerService;
import com.swd392.onlineshopping.customeraccount.web.dto.AccountRequests;
import com.swd392.onlineshopping.customeraccount.web.dto.CustomerRequests;
import java.math.BigDecimal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Nap san vai khach hang + tai khoan de bam thu API ngay sau khi chay (profile 'demo').
 */
@Component
@Profile("demo")
public class DemoDataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);

    private final CustomerRepository customers;
    private final CustomerService customerService;
    private final AccountService accountService;

    public DemoDataSeeder(CustomerRepository customers, CustomerService customerService,
                          AccountService accountService) {
        this.customers = customers;
        this.customerService = customerService;
        this.accountService = accountService;
    }

    @Override
    public void run(String... args) {
        if (customers.count() > 0) {
            return;
        }

        seed("Nguyen The Minh", "minh@fpt.edu.vn", "0901234567", "Q9, TP.HCM", new BigDecimal("1000.00"));
        seed("Tran Ngoc Huy", "huy@fpt.edu.vn", "0912345678", "Thu Duc, TP.HCM", new BigDecimal("250.00"));

        log.info("Da nap du lieu demo: {} khach hang.", customers.count());
    }

    private void seed(String name, String email, String phone, String address, BigDecimal balance) {
        var customer = customerService.create(
                new CustomerRequests.CreateCustomer(name, email, phone, address));
        var account = accountService.createAccount(
                new AccountRequests.CreateAccount(customer.getId(), balance));
        log.info("  {} -> tai khoan {} (so du {})", name, account.getAccountNumber(), account.getBalance());
    }
}
