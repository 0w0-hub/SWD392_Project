package com.swd392.onlineshopping.customeraccount.service;

import com.swd392.onlineshopping.customeraccount.domain.AccountHold;
import com.swd392.onlineshopping.customeraccount.domain.AccountTransaction;
import com.swd392.onlineshopping.customeraccount.domain.Customer;
import com.swd392.onlineshopping.customeraccount.domain.CustomerAccount;
import com.swd392.onlineshopping.customeraccount.domain.HoldStatus;
import com.swd392.onlineshopping.customeraccount.domain.TransactionType;
import com.swd392.onlineshopping.customeraccount.exception.BusinessRuleException;
import com.swd392.onlineshopping.customeraccount.exception.NotFoundException;
import com.swd392.onlineshopping.customeraccount.repository.AccountHoldRepository;
import com.swd392.onlineshopping.customeraccount.repository.AccountTransactionRepository;
import com.swd392.onlineshopping.customeraccount.repository.CustomerAccountRepository;
import com.swd392.onlineshopping.customeraccount.web.dto.AccountRequests;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Nghiep vu tren entity CustomerAccount - day la phan ma Billing Coordinator goi toi.
 *
 * <p>Vong doi thanh toan cua mot don hang:
 * <pre>
 *   placeHold(orderId)    Billing Coordinator authorize   -> tien bi khoa, so du chua doi
 *   captureHold(orderId)  hang da giao, confirm billing   -> tru tien that
 *   releaseHold(orderId)  don hang bi huy                 -> tra lai tien cho khach
 * </pre>
 * Ca ba thao tac deu idempotent theo {@code orderId}: goi lai lan hai khong lam tien bi
 * tru hay tra hai lan.
 */
@Service
@Transactional(readOnly = true)
public class AccountService {

    private static final int MONEY_SCALE = 2;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final CustomerAccountRepository accounts;
    private final AccountHoldRepository holds;
    private final AccountTransactionRepository transactions;
    private final CustomerService customerService;

    public AccountService(CustomerAccountRepository accounts,
                          AccountHoldRepository holds,
                          AccountTransactionRepository transactions,
                          CustomerService customerService) {
        this.accounts = accounts;
        this.holds = holds;
        this.transactions = transactions;
        this.customerService = customerService;
    }

    @Transactional
    public CustomerAccount createAccount(AccountRequests.CreateAccount req) {
        Customer customer = customerService.getById(req.customerId());
        if (!customer.isActive()) {
            throw new BusinessRuleException("Khach hang id=" + customer.getId() + " dang khong hoat dong.");
        }
        if (accounts.existsByCustomerId(customer.getId())) {
            throw new BusinessRuleException("Khach hang id=" + customer.getId() + " da co tai khoan.");
        }

        CustomerAccount account = new CustomerAccount(generateAccountNumber(), customer);
        BigDecimal initial = normalize(req.initialBalance() == null ? BigDecimal.ZERO : req.initialBalance());
        if (initial.signum() > 0) {
            account.deposit(initial);
        }
        accounts.save(account);

        if (initial.signum() > 0) {
            record(account, TransactionType.DEPOSIT, initial, null, "So du khoi tao");
        }
        return account;
    }

    public CustomerAccount getById(Long accountId) {
        return accounts.findWithCustomerById(accountId)
                .orElseThrow(() -> new NotFoundException("Khong tim thay tai khoan id=" + accountId));
    }

    public CustomerAccount getByAccountNumber(String accountNumber) {
        return accounts.findWithCustomerByAccountNumber(accountNumber)
                .orElseThrow(() -> new NotFoundException("Khong tim thay tai khoan so " + accountNumber));
    }

    public List<CustomerAccount> findByCustomer(Long customerId) {
        customerService.getById(customerId);
        return accounts.findWithCustomerByCustomerId(customerId);
    }

    public List<AccountTransaction> findTransactions(Long accountId) {
        getById(accountId);
        return transactions.findByAccountIdOrderByIdDesc(accountId);
    }

    public List<AccountHold> findHolds(Long accountId) {
        getById(accountId);
        return holds.findWithAccountByAccountId(accountId);
    }

    public AccountHold getHoldByOrderId(String orderId) {
        return holds.findWithAccountByOrderId(orderId)
                .orElseThrow(() -> new NotFoundException("Khong tim thay khoan giu cho don hang " + orderId));
    }

    // --- Nap / rut / hoan tien -------------------------------------------

    @Transactional
    public CustomerAccount deposit(Long accountId, AccountRequests.MoneyAmount req) {
        CustomerAccount account = lock(accountId);
        BigDecimal amount = normalize(req.amount());
        account.deposit(amount);
        record(account, TransactionType.DEPOSIT, amount, null, req.description());
        return getById(accountId);
    }

    @Transactional
    public CustomerAccount withdraw(Long accountId, AccountRequests.MoneyAmount req) {
        CustomerAccount account = lock(accountId);
        BigDecimal amount = normalize(req.amount());
        account.withdraw(amount);
        record(account, TransactionType.WITHDRAW, amount, null, req.description());
        return getById(accountId);
    }

    @Transactional
    public CustomerAccount refund(Long accountId, AccountRequests.MoneyAmount req) {
        CustomerAccount account = lock(accountId);
        BigDecimal amount = normalize(req.amount());
        account.refund(amount);
        record(account, TransactionType.REFUND, amount, null, req.description());
        return getById(accountId);
    }

    // --- Vong doi thanh toan cua don hang ---------------------------------

    /**
     * Authorize: giu tien cho mot don hang. Neu {@code orderId} da co khoan giu thi tra lai
     * chinh khoan do thay vi giu them lan nua.
     */
    @Transactional
    public AccountHold placeHold(Long accountId, AccountRequests.PlaceHold req) {
        var existing = holds.findWithAccountByOrderId(req.orderId());
        if (existing.isPresent()) {
            return existing.get();
        }

        CustomerAccount account = lock(accountId);
        BigDecimal amount = normalize(req.amount());
        account.hold(amount);

        AccountHold hold = holds.save(new AccountHold(account, req.orderId(), amount));
        record(account, TransactionType.HOLD, amount, req.orderId(),
                req.description() == null ? "Giu tien cho don hang " + req.orderId() : req.description());
        return hold;
    }

    /** Confirm billing: hang da giao -> tru han khoan da giu khoi so du. */
    @Transactional
    public AccountHold captureHold(String orderId) {
        AccountHold hold = getHoldByOrderId(orderId);
        if (hold.getStatus() == HoldStatus.CAPTURED) {
            return hold;
        }
        if (hold.getStatus() == HoldStatus.RELEASED) {
            throw new BusinessRuleException(
                    "Khoan giu cua don hang " + orderId + " da duoc tra lai, khong the tru tien.");
        }

        CustomerAccount account = lock(hold.getAccount().getId());
        account.capture(hold.getAmount());
        hold.markCaptured();
        record(account, TransactionType.CAPTURE, hold.getAmount(), orderId,
                "Tru tien khi giao don hang " + orderId);
        return hold;
    }

    /** Don hang bi huy truoc luc giao -> tra lai tien cho khach. */
    @Transactional
    public AccountHold releaseHold(String orderId) {
        AccountHold hold = getHoldByOrderId(orderId);
        if (hold.getStatus() == HoldStatus.RELEASED) {
            return hold;
        }
        if (hold.getStatus() == HoldStatus.CAPTURED) {
            throw new BusinessRuleException(
                    "Khoan giu cua don hang " + orderId + " da bi tru tien, hay dung nghiep vu hoan tien.");
        }

        CustomerAccount account = lock(hold.getAccount().getId());
        account.release(hold.getAmount());
        hold.markReleased();
        record(account, TransactionType.RELEASE, hold.getAmount(), orderId,
                "Tra lai tien khi huy don hang " + orderId);
        return hold;
    }

    // --- Helper -----------------------------------------------------------

    private CustomerAccount lock(Long accountId) {
        return accounts.findByIdForUpdate(accountId)
                .orElseThrow(() -> new NotFoundException("Khong tim thay tai khoan id=" + accountId));
    }

    private void record(CustomerAccount account, TransactionType type, BigDecimal amount,
                        String referenceId, String description) {
        transactions.save(new AccountTransaction(account, type, amount, referenceId, description));
    }

    private static BigDecimal normalize(BigDecimal amount) {
        return amount.setScale(MONEY_SCALE, RoundingMode.HALF_UP);
    }

    private String generateAccountNumber() {
        for (int attempt = 0; attempt < 5; attempt++) {
            String candidate = "ACC%010d".formatted(Math.abs(RANDOM.nextLong() % 10_000_000_000L));
            if (accounts.findByAccountNumber(candidate).isEmpty()) {
                return candidate;
            }
        }
        throw new IllegalStateException("Khong sinh duoc so tai khoan duy nhat sau 5 lan thu.");
    }
}
