package com.swd392.onlineshopping.customeraccount.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.swd392.onlineshopping.customeraccount.domain.CustomerAccount;
import com.swd392.onlineshopping.customeraccount.domain.HoldStatus;
import com.swd392.onlineshopping.customeraccount.exception.BusinessRuleException;
import com.swd392.onlineshopping.customeraccount.exception.InsufficientFundsException;
import com.swd392.onlineshopping.customeraccount.web.dto.AccountRequests;
import com.swd392.onlineshopping.customeraccount.web.dto.CustomerRequests;
import java.math.BigDecimal;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Vong doi thanh toan cua don hang: hold (authorize) -> capture / release.
 */
@SpringBootTest
class AccountServiceTest {

    private static final AtomicInteger SEQ = new AtomicInteger();

    @Autowired
    private CustomerService customerService;

    @Autowired
    private AccountService accountService;

    private CustomerAccount newAccountWithBalance(String balance) {
        int n = SEQ.incrementAndGet();
        var customer = customerService.create(new CustomerRequests.CreateCustomer(
                "Khach " + n, "khach" + n + "@test.vn", "0900000000", "TP.HCM"));
        return accountService.createAccount(
                new AccountRequests.CreateAccount(customer.getId(), new BigDecimal(balance)));
    }

    @Test
    void hold_khoaTienNhungChuaTruSoDu() {
        CustomerAccount account = newAccountWithBalance("1000");

        accountService.placeHold(account.getId(),
                new AccountRequests.PlaceHold("ORD-001", new BigDecimal("300"), null));

        CustomerAccount after = accountService.getById(account.getId());
        assertThat(after.getBalance()).isEqualByComparingTo("1000");
        assertThat(after.getHeldAmount()).isEqualByComparingTo("300");
        assertThat(after.getAvailableBalance()).isEqualByComparingTo("700");
    }

    @Test
    void capture_truTienThatKhiHangDaGiao() {
        CustomerAccount account = newAccountWithBalance("1000");
        accountService.placeHold(account.getId(),
                new AccountRequests.PlaceHold("ORD-002", new BigDecimal("300"), null));

        accountService.captureHold("ORD-002");

        CustomerAccount after = accountService.getById(account.getId());
        assertThat(after.getBalance()).isEqualByComparingTo("700");
        assertThat(after.getHeldAmount()).isEqualByComparingTo("0");
        assertThat(after.getAvailableBalance()).isEqualByComparingTo("700");
    }

    @Test
    void release_traLaiTienKhiHuyDonHang() {
        CustomerAccount account = newAccountWithBalance("1000");
        accountService.placeHold(account.getId(),
                new AccountRequests.PlaceHold("ORD-003", new BigDecimal("300"), null));

        accountService.releaseHold("ORD-003");

        CustomerAccount after = accountService.getById(account.getId());
        assertThat(after.getBalance()).isEqualByComparingTo("1000");
        assertThat(after.getHeldAmount()).isEqualByComparingTo("0");
    }

    @Test
    void hold_khongDuTien_thiTuChoi() {
        CustomerAccount account = newAccountWithBalance("100");

        assertThatThrownBy(() -> accountService.placeHold(account.getId(),
                new AccountRequests.PlaceHold("ORD-004", new BigDecimal("150"), null)))
                .isInstanceOf(InsufficientFundsException.class);

        assertThat(accountService.getById(account.getId()).getHeldAmount()).isEqualByComparingTo("0");
    }

    @Test
    void hold_tienDangGiuKhongPhaiTienConTieuDuoc() {
        CustomerAccount account = newAccountWithBalance("200");
        accountService.placeHold(account.getId(),
                new AccountRequests.PlaceHold("ORD-005", new BigDecimal("150"), null));

        // Con 200 trong tai khoan nhung 150 dang bi giu -> chi con 50 tieu duoc.
        assertThatThrownBy(() -> accountService.placeHold(account.getId(),
                new AccountRequests.PlaceHold("ORD-006", new BigDecimal("60"), null)))
                .isInstanceOf(InsufficientFundsException.class);
    }

    @Test
    void hold_goiLaiCungOrderId_thiKhongGiuTienHaiLan() {
        CustomerAccount account = newAccountWithBalance("1000");
        var req = new AccountRequests.PlaceHold("ORD-007", new BigDecimal("300"), null);

        var first = accountService.placeHold(account.getId(), req);
        var second = accountService.placeHold(account.getId(), req);

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(accountService.getById(account.getId()).getHeldAmount()).isEqualByComparingTo("300");
    }

    @Test
    void capture_goiLaiLanHai_thiKhongTruTienHaiLan() {
        CustomerAccount account = newAccountWithBalance("1000");
        accountService.placeHold(account.getId(),
                new AccountRequests.PlaceHold("ORD-008", new BigDecimal("300"), null));

        accountService.captureHold("ORD-008");
        var second = accountService.captureHold("ORD-008");

        assertThat(second.getStatus()).isEqualTo(HoldStatus.CAPTURED);
        assertThat(accountService.getById(account.getId()).getBalance()).isEqualByComparingTo("700");
    }

    @Test
    void release_sauKhiDaCapture_thiBiTuChoi() {
        CustomerAccount account = newAccountWithBalance("1000");
        accountService.placeHold(account.getId(),
                new AccountRequests.PlaceHold("ORD-009", new BigDecimal("300"), null));
        accountService.captureHold("ORD-009");

        assertThatThrownBy(() -> accountService.releaseHold("ORD-009"))
                .isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void soCaiGhiLaiTungBuocCuaDonHang() {
        CustomerAccount account = newAccountWithBalance("1000");
        accountService.placeHold(account.getId(),
                new AccountRequests.PlaceHold("ORD-010", new BigDecimal("300"), null));
        accountService.captureHold("ORD-010");

        var types = accountService.findTransactions(account.getId()).stream()
                .map(t -> t.getType().name())
                .toList();
        assertThat(types).containsExactly("CAPTURE", "HOLD", "DEPOSIT");
    }
}
