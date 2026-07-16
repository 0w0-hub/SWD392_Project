package com.swd392.onlineshopping.customeraccount.web.dto;

import com.swd392.onlineshopping.customeraccount.domain.AccountHold;
import com.swd392.onlineshopping.customeraccount.domain.AccountTransaction;
import com.swd392.onlineshopping.customeraccount.domain.Customer;
import com.swd392.onlineshopping.customeraccount.domain.CustomerAccount;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

/** Cac DTO tra ve cho client - khong lo entity JPA ra ngoai API. */
public final class Responses {

    private Responses() {
    }

    public record CustomerView(
            Long id,
            String fullName,
            String email,
            String phone,
            String deliveryAddress,
            String status,
            Instant createdAt) {

        public static CustomerView of(Customer c) {
            return new CustomerView(c.getId(), c.getFullName(), c.getEmail(), c.getPhone(),
                    c.getDeliveryAddress(), c.getStatus().name(), c.getCreatedAt());
        }
    }

    public record AccountView(
            Long id,
            String accountNumber,
            Long customerId,
            String customerName,
            BigDecimal balance,
            BigDecimal heldAmount,
            BigDecimal availableBalance,
            String currency,
            String status,
            Instant createdAt) {

        public static AccountView of(CustomerAccount a) {
            return new AccountView(a.getId(), a.getAccountNumber(), a.getCustomer().getId(),
                    a.getCustomer().getFullName(), a.getBalance(), a.getHeldAmount(),
                    a.getAvailableBalance(), a.getCurrency(), a.getStatus().name(), a.getCreatedAt());
        }
    }

    public record HoldView(
            Long id,
            String orderId,
            String accountNumber,
            BigDecimal amount,
            String status,
            Instant createdAt,
            Instant settledAt) {

        public static HoldView of(AccountHold h) {
            return new HoldView(h.getId(), h.getOrderId(), h.getAccount().getAccountNumber(),
                    h.getAmount(), h.getStatus().name(), h.getCreatedAt(), h.getSettledAt());
        }
    }

    public record TransactionView(
            Long id,
            String type,
            BigDecimal amount,
            BigDecimal balanceAfter,
            String referenceId,
            String description,
            Instant createdAt) {

        public static TransactionView of(AccountTransaction t) {
            return new TransactionView(t.getId(), t.getType().name(), t.getAmount(), t.getBalanceAfter(),
                    t.getReferenceId(), t.getDescription(), t.getCreatedAt());
        }
    }

    /** Body loi thong nhat cho toan bo service. */
    public record ApiError(
            Instant timestamp,
            int status,
            String error,
            String message,
            Map<String, String> details) {

        public static ApiError of(int status, String error, String message) {
            return new ApiError(Instant.now(), status, error, message, Map.of());
        }

        public static ApiError of(int status, String error, String message, Map<String, String> details) {
            return new ApiError(Instant.now(), status, error, message, details);
        }
    }
}
