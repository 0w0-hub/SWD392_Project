package com.swd392.onlineshopping.customeraccount.domain;

/**
 * Trang thai cua mot khoan tien bi giu cho don hang.
 */
public enum HoldStatus {
    /** Da authorize: tien bi khoa lai, chua tru khoi so du. */
    HELD,
    /** Da confirm billing (hang da giao) -> tien da bi tru that su. */
    CAPTURED,
    /** Don hang bi huy -> tien da duoc tra lai cho khach. */
    RELEASED
}
