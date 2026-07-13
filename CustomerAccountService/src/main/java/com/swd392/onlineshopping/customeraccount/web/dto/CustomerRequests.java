package com.swd392.onlineshopping.customeraccount.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Cac DTO dau vao cho entity Customer. */
public final class CustomerRequests {

    private CustomerRequests() {
    }

    public record CreateCustomer(
            @NotBlank @Size(max = 100) String fullName,
            @NotBlank @Email @Size(max = 150) String email,
            @NotBlank @Size(max = 20) String phone,
            @Size(max = 255) String deliveryAddress) {
    }

    public record UpdateCustomer(
            @NotBlank @Size(max = 100) String fullName,
            @NotBlank @Size(max = 20) String phone,
            @Size(max = 255) String deliveryAddress) {
    }
}
