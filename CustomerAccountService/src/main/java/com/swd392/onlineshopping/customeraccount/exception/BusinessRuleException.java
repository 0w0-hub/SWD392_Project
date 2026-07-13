package com.swd392.onlineshopping.customeraccount.exception;

/** Vi pham quy tac nghiep vu -> HTTP 409. */
public class BusinessRuleException extends RuntimeException {

    public BusinessRuleException(String message) {
        super(message);
    }
}
