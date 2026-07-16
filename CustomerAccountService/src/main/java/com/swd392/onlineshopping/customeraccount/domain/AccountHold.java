package com.swd392.onlineshopping.customeraccount.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * Khoan tien dang bi giu cho mot don hang cu the.
 *
 * <p>{@code orderId} la unique: Billing Coordinator co goi lai API authorize nhieu lan
 * (retry, mat goi tin) thi tien cung chi bi giu dung mot lan.
 */
@Entity
@Table(name = "account_holds", uniqueConstraints = {
        @UniqueConstraint(name = "uk_hold_order", columnNames = "order_id")
})
public class AccountHold {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private CustomerAccount account;

    /** Ma don hang ben DeliveryOrderService. */
    @Column(name = "order_id", nullable = false, length = 64)
    private String orderId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private HoldStatus status = HoldStatus.HELD;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    private Instant settledAt;

    protected AccountHold() {
    }

    public AccountHold(CustomerAccount account, String orderId, BigDecimal amount) {
        this.account = account;
        this.orderId = orderId;
        this.amount = amount;
    }

    public void markCaptured() {
        this.status = HoldStatus.CAPTURED;
        this.settledAt = Instant.now();
    }

    public void markReleased() {
        this.status = HoldStatus.RELEASED;
        this.settledAt = Instant.now();
    }

    public boolean isHeld() {
        return status == HoldStatus.HELD;
    }

    public Long getId() {
        return id;
    }

    public CustomerAccount getAccount() {
        return account;
    }

    public String getOrderId() {
        return orderId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public HoldStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getSettledAt() {
        return settledAt;
    }
}
