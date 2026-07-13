package com.swd392.onlineshopping.customeraccount.repository;

import com.swd392.onlineshopping.customeraccount.domain.AccountTransaction;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountTransactionRepository extends JpaRepository<AccountTransaction, Long> {

    /** Moi nhat truoc. Sap theo id vi hai giao dich lien tiep co the trung moc thoi gian. */
    List<AccountTransaction> findByAccountIdOrderByIdDesc(Long accountId);
}
