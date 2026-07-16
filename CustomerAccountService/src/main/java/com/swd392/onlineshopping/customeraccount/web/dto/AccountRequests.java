package com.swd392.onlineshopping.customeraccount.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/** Cac DTO dau vao cho entity CustomerAccount. */
public final class AccountRequests {

    private AccountRequests() {
    }

    public record CreateAccount(
            @NotNull Long customerId,
            @DecimalMin(value = "0.0") @Digits(integer = 13, fraction = 2) BigDecimal initialBalance) {
    }

    /** Dung cho nap tien / rut tien / hoan tien. */
    public record MoneyAmount(
            @NotNull @DecimalMin(value = "0.01", message = "So tien phai lon hon 0")
            @Digits(integer = 13, fraction = 2) BigDecimal amount,
            @Size(max = 255) String description) {
    }

    /** Billing Coordinator goi khi authorize thanh toan cho mot don hang. */
    public record PlaceHold(
            @NotBlank @Size(max = 64) String orderId,
            @NotNull @DecimalMin(value = "0.01", message = "So tien phai lon hon 0")
            @Digits(integer = 13, fraction = 2) BigDecimal amount,
            @Size(max = 255) String description) {
    }
}
