package com.swd392.onlineshopping.customeraccount.repository;

import com.swd392.onlineshopping.customeraccount.domain.CustomerAccount;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CustomerAccountRepository extends JpaRepository<CustomerAccount, Long> {

    boolean existsByCustomerId(Long customerId);

    Optional<CustomerAccount> findByAccountNumber(String accountNumber);

    /*
     * Cac truy van doc ben duoi deu "join fetch a.customer". Vi open-in-view dang tat, neu
     * de customer o dang lazy proxy thi luc map sang AccountView (da ra ngoai transaction)
     * se no LazyInitializationException.
     */

    @Query("select a from CustomerAccount a join fetch a.customer where a.id = :id")
    Optional<CustomerAccount> findWithCustomerById(@Param("id") Long id);

    @Query("select a from CustomerAccount a join fetch a.customer where a.accountNumber = :accountNumber")
    Optional<CustomerAccount> findWithCustomerByAccountNumber(@Param("accountNumber") String accountNumber);

    @Query("select a from CustomerAccount a join fetch a.customer c where c.id = :customerId")
    List<CustomerAccount> findWithCustomerByCustomerId(@Param("customerId") Long customerId);

    List<CustomerAccount> findByCustomerId(Long customerId);

    /**
     * Khoa dong tai khoan truoc khi doi so du.
     *
     * <p>Hai don hang authorize cung luc tren cung mot tai khoan se bi tuan tu hoa o day,
     * nen chung khong the cung nhin thay mot so du kha dung roi cung giu tien tren do.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from CustomerAccount a where a.id = :id")
    Optional<CustomerAccount> findByIdForUpdate(@Param("id") Long id);
}
