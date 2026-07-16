package com.swd392.onlineshopping.customeraccount.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.swd392.onlineshopping.customeraccount.web.dto.AccountRequests;
import com.swd392.onlineshopping.customeraccount.web.dto.CustomerRequests;
import com.swd392.onlineshopping.customeraccount.web.dto.Responses.AccountView;
import com.swd392.onlineshopping.customeraccount.web.dto.Responses.ApiError;
import com.swd392.onlineshopping.customeraccount.web.dto.Responses.CustomerView;
import com.swd392.onlineshopping.customeraccount.web.dto.Responses.HoldView;
import java.math.BigDecimal;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * Di qua HTTP that, khong goi thang service.
 *
 * <p>Lop test nay ton tai vi mot loi that da lot qua tang service: open-in-view dang tat,
 * nen entity chi no LazyInitializationException khi duoc map sang DTO o tang web - test
 * goi thang service khong bao gio thay loi do.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AccountApiTest {

    private static final AtomicInteger SEQ = new AtomicInteger();

    @Autowired
    private TestRestTemplate rest;

    private AccountView createAccount(String balance) {
        int n = SEQ.incrementAndGet();
        CustomerView customer = rest.postForObject("/api/v1/customers",
                new CustomerRequests.CreateCustomer("Web Khach " + n, "web" + n + "@test.vn",
                        "0900000000", "TP.HCM"),
                CustomerView.class);
        return rest.postForObject("/api/v1/accounts",
                new AccountRequests.CreateAccount(customer.id(), new BigDecimal(balance)),
                AccountView.class);
    }

    @Test
    void luongDayDu_authorizeRoiConfirmBilling() {
        AccountView account = createAccount("1000");

        HoldView hold = rest.postForObject("/api/v1/accounts/" + account.id() + "/holds",
                new AccountRequests.PlaceHold("WEB-ORD-1", new BigDecimal("300"), "Don hang #1"),
                HoldView.class);
        assertThat(hold.status()).isEqualTo("HELD");
        assertThat(hold.accountNumber()).isEqualTo(account.accountNumber());

        AccountView afterHold = rest.getForObject("/api/v1/accounts/" + account.id(), AccountView.class);
        assertThat(afterHold.balance()).isEqualByComparingTo("1000.00");
        assertThat(afterHold.availableBalance()).isEqualByComparingTo("700.00");

        HoldView captured = rest.postForObject("/api/v1/accounts/holds/WEB-ORD-1/capture", null,
                HoldView.class);
        assertThat(captured.status()).isEqualTo("CAPTURED");

        AccountView afterCapture = rest.getForObject("/api/v1/accounts/" + account.id(), AccountView.class);
        assertThat(afterCapture.balance()).isEqualByComparingTo("700.00");
        assertThat(afterCapture.heldAmount()).isEqualByComparingTo("0.00");
    }

    @Test
    void huyDonHang_thiTraLaiTien() {
        AccountView account = createAccount("1000");
        rest.postForObject("/api/v1/accounts/" + account.id() + "/holds",
                new AccountRequests.PlaceHold("WEB-ORD-2", new BigDecimal("300"), null), HoldView.class);

        HoldView released = rest.postForObject("/api/v1/accounts/holds/WEB-ORD-2/release", null,
                HoldView.class);
        assertThat(released.status()).isEqualTo("RELEASED");

        AccountView after = rest.getForObject("/api/v1/accounts/" + account.id(), AccountView.class);
        assertThat(after.availableBalance()).isEqualByComparingTo("1000.00");
    }

    @Test
    void khongDuTien_thiTraVe422VaKhongGiuTien() {
        AccountView account = createAccount("100");

        ResponseEntity<ApiError> response = rest.postForEntity("/api/v1/accounts/" + account.id() + "/holds",
                new AccountRequests.PlaceHold("WEB-ORD-3", new BigDecimal("150"), null), ApiError.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(response.getBody().error()).isEqualTo("INSUFFICIENT_FUNDS");

        AccountView after = rest.getForObject("/api/v1/accounts/" + account.id(), AccountView.class);
        assertThat(after.heldAmount()).isEqualByComparingTo("0.00");
    }

    @Test
    void duLieuKhongHopLe_thiTraVe400() {
        ResponseEntity<ApiError> response = rest.postForEntity("/api/v1/customers",
                new CustomerRequests.CreateCustomer("", "khong-phai-email", "", null), ApiError.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().error()).isEqualTo("VALIDATION_FAILED");
        assertThat(response.getBody().details()).containsKeys("fullName", "email");
    }

    @Test
    void khongTimThayTaiKhoan_thiTraVe404() {
        ResponseEntity<ApiError> response = rest.getForEntity("/api/v1/accounts/999999", ApiError.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody().error()).isEqualTo("NOT_FOUND");
    }
}
