package com.swd392.onlineshopping.customeraccount.web;

import com.swd392.onlineshopping.customeraccount.exception.BusinessRuleException;
import com.swd392.onlineshopping.customeraccount.exception.DuplicateException;
import com.swd392.onlineshopping.customeraccount.exception.InsufficientFundsException;
import com.swd392.onlineshopping.customeraccount.exception.NotFoundException;
import com.swd392.onlineshopping.customeraccount.web.dto.Responses.ApiError;
import java.util.HashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Dich exception nghiep vu thanh ma HTTP on dinh, de Billing Coordinator xu ly duoc bang
 * ma tra ve thay vi phai doc chuoi loi.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(NotFoundException ex) {
        return build(HttpStatus.NOT_FOUND, "NOT_FOUND", ex.getMessage());
    }

    /** 422: yeu cau dung cu phap nhung tai khoan khong du tien -> don hang bi tu choi. */
    @ExceptionHandler(InsufficientFundsException.class)
    public ResponseEntity<ApiError> handleInsufficientFunds(InsufficientFundsException ex) {
        Map<String, String> details = new HashMap<>();
        details.put("accountNumber", ex.getAccountNumber());
        details.put("available", String.valueOf(ex.getAvailable()));
        details.put("requested", String.valueOf(ex.getRequested()));
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(ApiError.of(HttpStatus.UNPROCESSABLE_ENTITY.value(), "INSUFFICIENT_FUNDS",
                        ex.getMessage(), details));
    }

    @ExceptionHandler(DuplicateException.class)
    public ResponseEntity<ApiError> handleDuplicate(DuplicateException ex) {
        return build(HttpStatus.CONFLICT, "DUPLICATE", ex.getMessage());
    }

    @ExceptionHandler(BusinessRuleException.class)
    public ResponseEntity<ApiError> handleBusinessRule(BusinessRuleException ex) {
        return build(HttpStatus.CONFLICT, "BUSINESS_RULE_VIOLATED", ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new HashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(err -> fieldErrors.put(err.getField(), err.getDefaultMessage()));
        return ResponseEntity.badRequest()
                .body(ApiError.of(HttpStatus.BAD_REQUEST.value(), "VALIDATION_FAILED",
                        "Du lieu dau vao khong hop le.", fieldErrors));
    }

    private ResponseEntity<ApiError> build(HttpStatus status, String error, String message) {
        return ResponseEntity.status(status).body(ApiError.of(status.value(), error, message));
    }
}
