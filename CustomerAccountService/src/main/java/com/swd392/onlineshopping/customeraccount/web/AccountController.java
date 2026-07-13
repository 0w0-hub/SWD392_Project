package com.swd392.onlineshopping.customeraccount.web;

import com.swd392.onlineshopping.customeraccount.service.AccountService;
import com.swd392.onlineshopping.customeraccount.web.dto.AccountRequests;
import com.swd392.onlineshopping.customeraccount.web.dto.Responses.AccountView;
import com.swd392.onlineshopping.customeraccount.web.dto.Responses.HoldView;
import com.swd392.onlineshopping.customeraccount.web.dto.Responses.TransactionView;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * API cho entity CustomerAccount.
 *
 * <p>Nhom endpoint duoi {@code /holds} chinh la giao dien ma Billing Coordinator dung khi
 * authorize / confirm billing / huy don hang.
 */
@RestController
@RequestMapping("/api/v1/accounts")
public class AccountController {

    private final AccountService accountService;

    public AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    @PostMapping
    public ResponseEntity<AccountView> create(@Valid @RequestBody AccountRequests.CreateAccount req) {
        AccountView view = AccountView.of(accountService.createAccount(req));
        return ResponseEntity.created(URI.create("/api/v1/accounts/" + view.id())).body(view);
    }

    @GetMapping("/{id}")
    public AccountView getById(@PathVariable Long id) {
        return AccountView.of(accountService.getById(id));
    }

    @GetMapping("/by-number/{accountNumber}")
    public AccountView getByNumber(@PathVariable String accountNumber) {
        return AccountView.of(accountService.getByAccountNumber(accountNumber));
    }

    @GetMapping("/by-customer/{customerId}")
    public List<AccountView> getByCustomer(@PathVariable Long customerId) {
        return accountService.findByCustomer(customerId).stream().map(AccountView::of).toList();
    }

    @GetMapping("/{id}/transactions")
    public List<TransactionView> transactions(@PathVariable Long id) {
        return accountService.findTransactions(id).stream().map(TransactionView::of).toList();
    }

    @GetMapping("/{id}/holds")
    public List<HoldView> holds(@PathVariable Long id) {
        return accountService.findHolds(id).stream().map(HoldView::of).toList();
    }

    // --- Nap / rut / hoan tien -------------------------------------------

    @PostMapping("/{id}/deposit")
    public AccountView deposit(@PathVariable Long id, @Valid @RequestBody AccountRequests.MoneyAmount req) {
        return AccountView.of(accountService.deposit(id, req));
    }

    @PostMapping("/{id}/withdraw")
    public AccountView withdraw(@PathVariable Long id, @Valid @RequestBody AccountRequests.MoneyAmount req) {
        return AccountView.of(accountService.withdraw(id, req));
    }

    @PostMapping("/{id}/refund")
    public AccountView refund(@PathVariable Long id, @Valid @RequestBody AccountRequests.MoneyAmount req) {
        return AccountView.of(accountService.refund(id, req));
    }

    // --- Thanh toan cho don hang -----------------------------------------

    /** Billing Coordinator authorize thanh toan cho don hang. Idempotent theo orderId. */
    @PostMapping("/{id}/holds")
    public HoldView placeHold(@PathVariable Long id, @Valid @RequestBody AccountRequests.PlaceHold req) {
        return HoldView.of(accountService.placeHold(id, req));
    }

    /** Hang da giao -> confirm billing, tru tien that. */
    @PostMapping("/holds/{orderId}/capture")
    public HoldView capture(@PathVariable String orderId) {
        return HoldView.of(accountService.captureHold(orderId));
    }

    /** Don hang bi huy -> tra lai tien da giu. */
    @PostMapping("/holds/{orderId}/release")
    public HoldView release(@PathVariable String orderId) {
        return HoldView.of(accountService.releaseHold(orderId));
    }

    @GetMapping("/holds/{orderId}")
    public HoldView getHold(@PathVariable String orderId) {
        return HoldView.of(accountService.getHoldByOrderId(orderId));
    }
}
