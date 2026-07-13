package com.swd392.onlineshopping.customeraccount.exception;

/** Khong tim thay tai nguyen -> HTTP 404. */
public class NotFoundException extends RuntimeException {

    public NotFoundException(String message) {
        super(message);
    }
}
