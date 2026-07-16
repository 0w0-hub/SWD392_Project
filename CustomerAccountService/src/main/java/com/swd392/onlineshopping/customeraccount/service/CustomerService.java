package com.swd392.onlineshopping.customeraccount.service;

import com.swd392.onlineshopping.customeraccount.domain.Customer;
import com.swd392.onlineshopping.customeraccount.domain.CustomerStatus;
import com.swd392.onlineshopping.customeraccount.exception.BusinessRuleException;
import com.swd392.onlineshopping.customeraccount.exception.DuplicateException;
import com.swd392.onlineshopping.customeraccount.exception.NotFoundException;
import com.swd392.onlineshopping.customeraccount.repository.CustomerAccountRepository;
import com.swd392.onlineshopping.customeraccount.repository.CustomerRepository;
import com.swd392.onlineshopping.customeraccount.web.dto.CustomerRequests;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Nghiep vu tren entity Customer. Customer Coordinator goi cac thao tac nay.
 */
@Service
@Transactional(readOnly = true)
public class CustomerService {

    private final CustomerRepository customers;
    private final CustomerAccountRepository accounts;

    public CustomerService(CustomerRepository customers, CustomerAccountRepository accounts) {
        this.customers = customers;
        this.accounts = accounts;
    }

    @Transactional
    public Customer create(CustomerRequests.CreateCustomer req) {
        if (customers.existsByEmail(req.email())) {
            throw new DuplicateException("Email " + req.email() + " da duoc dang ky.");
        }
        return customers.save(
                new Customer(req.fullName(), req.email(), req.phone(), req.deliveryAddress()));
    }

    public Customer getById(Long id) {
        return customers.findById(id)
                .orElseThrow(() -> new NotFoundException("Khong tim thay khach hang id=" + id));
    }

    public Customer getByEmail(String email) {
        return customers.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("Khong tim thay khach hang voi email " + email));
    }

    public List<Customer> findAll() {
        return customers.findAll();
    }

    @Transactional
    public Customer update(Long id, CustomerRequests.UpdateCustomer req) {
        Customer customer = getById(id);
        customer.setFullName(req.fullName());
        customer.setPhone(req.phone());
        customer.setDeliveryAddress(req.deliveryAddress());
        return customer;
    }

    /**
     * Ngung kich hoat khach hang (soft delete). Khong xoa cung vi tai khoan va so cai
     * giao dich con phai giu lai de doi soat voi DeliveryOrderService.
     */
    @Transactional
    public Customer deactivate(Long id) {
        Customer customer = getById(id);
        boolean hasFundsHeld = accounts.findByCustomerId(id).stream()
                .anyMatch(account -> account.getHeldAmount().signum() > 0);
        if (hasFundsHeld) {
            throw new BusinessRuleException(
                    "Khach hang id=" + id + " con tien dang bi giu cho don hang chua tat toan.");
        }
        customer.setStatus(CustomerStatus.INACTIVE);
        return customer;
    }
}
