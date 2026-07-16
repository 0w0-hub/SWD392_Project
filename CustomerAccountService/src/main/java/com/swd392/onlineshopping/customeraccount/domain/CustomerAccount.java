package com.swd392.onlineshopping.customeraccount.domain;

import com.swd392.onlineshopping.customeraccount.exception.BusinessRuleException;
import com.swd392.onlineshopping.customeraccount.exception.InsufficientFundsException;
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
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * Entity CustomerAccount (Figure 22.10) - tai khoan thanh toan cua khach hang.
 *
 * <p>So du duoc tach lam hai phan:
 * <ul>
 *   <li>{@code balance}: tong tien dang co trong tai khoan.</li>
 *   <li>{@code heldAmount}: phan dang bi giu cho cac don hang da authorize nhung chua giao.</li>
 * </ul>
 * Khach chi tieu duoc phan {@code availableBalance = balance - heldAmount}. Nho vay hai
 * don hang dat cung luc khong the dung chung mot khoan tien.
 */
@Entity
@Table(name = "customer_accounts", uniqueConstraints = {
        @UniqueConstraint(name = "uk_account_number", columnNames = "account_number")
})
public class CustomerAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "account_number", nullable = false, length = 32)
    private String accountNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal balance = BigDecimal.ZERO;

    @Column(name = "held_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal heldAmount = BigDecimal.ZERO;

    @Column(nullable = false, length = 3)
    private String currency = "USD";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AccountStatus status = AccountStatus.ACTIVE;

    @Version
    private Long version;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    protected CustomerAccount() {
    }

    public CustomerAccount(String accountNumber, Customer customer) {
        this.accountNumber = accountNumber;
        this.customer = customer;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    /** So tien khach thuc su con tieu duoc. */
    public BigDecimal getAvailableBalance() {
        return balance.subtract(heldAmount);
    }

    public void deposit(BigDecimal amount) {
        requireActive();
        this.balance = this.balance.add(amount);
    }

    public void withdraw(BigDecimal amount) {
        requireActive();
        requireAvailable(amount);
        this.balance = this.balance.subtract(amount);
    }

    /** Authorize cho mot don hang: chua tru so du, chi khoa tien lai. */
    public void hold(BigDecimal amount) {
        requireActive();
        requireAvailable(amount);
        this.heldAmount = this.heldAmount.add(amount);
    }

    /** Confirm billing khi hang da giao: tru han khoan da giu ra khoi so du. */
    public void capture(BigDecimal amount) {
        requireHeld(amount);
        this.heldAmount = this.heldAmount.subtract(amount);
        this.balance = this.balance.subtract(amount);
    }

    /** Don hang bi huy: tra lai khoan da giu cho khach. */
    public void release(BigDecimal amount) {
        requireHeld(amount);
        this.heldAmount = this.heldAmount.subtract(amount);
    }

    /** Hoan tien vao tai khoan sau khi da tru (vd: khach tra hang). */
    public void refund(BigDecimal amount) {
        this.balance = this.balance.add(amount);
    }

    private void requireActive() {
        if (status != AccountStatus.ACTIVE) {
            throw new BusinessRuleException("Tai khoan " + accountNumber + " dang o trang thai " + status
                    + ", khong thuc hien duoc giao dich.");
        }
    }

    private void requireAvailable(BigDecimal amount) {
        if (getAvailableBalance().compareTo(amount) < 0) {
            throw new InsufficientFundsException(accountNumber, getAvailableBalance(), amount);
        }
    }

    private void requireHeld(BigDecimal amount) {
        if (heldAmount.compareTo(amount) < 0) {
            throw new BusinessRuleException("So tien dang giu (" + heldAmount + ") nho hon so tien yeu cau ("
                    + amount + ") tren tai khoan " + accountNumber + ".");
        }
    }

    public Long getId() {
        return id;
    }

    public String getAccountNumber() {
        return accountNumber;
    }

    public Customer getCustomer() {
        return customer;
    }

    public BigDecimal getBalance() {
        return balance;
    }

    public BigDecimal getHeldAmount() {
        return heldAmount;
    }

    public String getCurrency() {
        return currency;
    }

    public AccountStatus getStatus() {
        return status;
    }

    public void setStatus(AccountStatus status) {
        this.status = status;
    }

    public Long getVersion() {
        return version;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
