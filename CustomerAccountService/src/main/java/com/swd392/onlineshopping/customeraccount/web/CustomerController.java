package com.swd392.onlineshopping.customeraccount.web;

import com.swd392.onlineshopping.customeraccount.service.CustomerService;
import com.swd392.onlineshopping.customeraccount.web.dto.CustomerRequests;
import com.swd392.onlineshopping.customeraccount.web.dto.Responses.CustomerView;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * API cho entity Customer - Customer Coordinator la ben goi chinh.
 */
@RestController
@RequestMapping("/api/v1/customers")
public class CustomerController {

    private final CustomerService customerService;

    public CustomerController(CustomerService customerService) {
        this.customerService = customerService;
    }

    @PostMapping
    public ResponseEntity<CustomerView> create(@Valid @RequestBody CustomerRequests.CreateCustomer req) {
        CustomerView view = CustomerView.of(customerService.create(req));
        return ResponseEntity.created(URI.create("/api/v1/customers/" + view.id())).body(view);
    }

    @GetMapping
    public List<CustomerView> list(@RequestParam(required = false) String email) {
        if (email != null) {
            return List.of(CustomerView.of(customerService.getByEmail(email)));
        }
        return customerService.findAll().stream().map(CustomerView::of).toList();
    }

    @GetMapping("/{id}")
    public CustomerView getById(@PathVariable Long id) {
        return CustomerView.of(customerService.getById(id));
    }

    @PutMapping("/{id}")
    public CustomerView update(@PathVariable Long id, @Valid @RequestBody CustomerRequests.UpdateCustomer req) {
        return CustomerView.of(customerService.update(id, req));
    }

    /** Ngung kich hoat khach hang (soft delete). */
    @DeleteMapping("/{id}")
    public CustomerView deactivate(@PathVariable Long id) {
        return CustomerView.of(customerService.deactivate(id));
    }
}
