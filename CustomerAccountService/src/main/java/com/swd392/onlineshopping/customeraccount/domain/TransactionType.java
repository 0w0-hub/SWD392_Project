package com.swd392.onlineshopping.customeraccount.domain;

public enum TransactionType {
    /** Khach nap tien vao tai khoan. */
    DEPOSIT,
    /** Khach rut tien khoi tai khoan. */
    WITHDRAW,
    /** Authorize: giu tien cho mot don hang. */
    HOLD,
    /** Confirm billing: tru khoan da giu khi don hang duoc giao. */
    CAPTURE,
    /** Tra lai khoan da giu khi don hang bi huy truoc luc giao. */
    RELEASE,
    /** Hoan tien sau khi da tru (vd: khach tra hang). */
    REFUND
}
