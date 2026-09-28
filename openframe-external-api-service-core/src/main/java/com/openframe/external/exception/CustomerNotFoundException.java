package com.openframe.external.exception;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;

public class CustomerNotFoundException extends NotFoundException {
    public CustomerNotFoundException(String customerId) {
        super(ErrorCode.CUSTOMER_NOT_FOUND, "Customer not found: " + customerId);
    }
}
