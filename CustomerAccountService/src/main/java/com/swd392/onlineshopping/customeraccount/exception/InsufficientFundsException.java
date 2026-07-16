package com.swd392.onlineshopping.customeraccount.exception;

import java.math.BigDecimal;

/**
 * So du kha dung khong du de giu/tru tien -> HTTP 422.
 *
 * <p>Billing Coordinator dua vao loi nay de tu choi don hang.
 */
public class InsufficientFundsException extends RuntimeException {

    private final String accountNumber;
    private final BigDecimal available;
    private final BigDecimal requested;

    public InsufficientFundsException(String accountNumber, BigDecimal available, BigDecimal requested) {
        super("Tai khoan " + accountNumber + " chi con " + available + " nhung can " + requested + ".");
        this.accountNumber = accountNumber;
        this.available = available;
        this.requested = requested;
    }

    public String getAccountNumber() {
        return accountNumber;
    }

    public BigDecimal getAvailable() {
        return available;
    }

    public BigDecimal getRequested() {
        return requested;
    }
}
