package com.swd392.onlineshopping.customeraccount.repository;

import com.swd392.onlineshopping.customeraccount.domain.AccountHold;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AccountHoldRepository extends JpaRepository<AccountHold, Long> {

    /** Fetch luon account vi HoldView can accountNumber sau khi transaction da dong. */
    @Query("select h from AccountHold h join fetch h.account where h.orderId = :orderId")
    Optional<AccountHold> findWithAccountByOrderId(@Param("orderId") String orderId);

    /** Moi nhat truoc. Sap theo id vi hai giao dich lien tiep co the trung moc thoi gian. */
    @Query("select h from AccountHold h join fetch h.account where h.account.id = :accountId order by h.id desc")
    List<AccountHold> findWithAccountByAccountId(@Param("accountId") Long accountId);
}
