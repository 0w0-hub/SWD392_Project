package com.swd392.onlineshopping.customeraccount.exception;

/** Tai nguyen da ton tai (vd: email da duoc dang ky) -> HTTP 409. */
public class DuplicateException extends RuntimeException {

    public DuplicateException(String message) {
        super(message);
    }
}
