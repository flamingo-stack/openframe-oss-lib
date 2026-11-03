package com.openframe.api.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.time.LocalDate;

public class ContractPeriodValidator implements ConstraintValidator<ValidContractPeriod, ContractPeriod> {

    public static boolean endsBeforeStart(LocalDate start, LocalDate end) {
        if (start == null || end == null) {
            return false;
        }
        return end.isBefore(start);
    }

    @Override
    public boolean isValid(ContractPeriod value, ConstraintValidatorContext context) {
        if (value == null) {
            return true;
        }
        boolean invalid = endsBeforeStart(value.contractStartDate(), value.contractEndDate());
        if (invalid) {
            // Reported on the end date so the client gets a field error instead of an object-level one.
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate(context.getDefaultConstraintMessageTemplate())
                    .addPropertyNode(ValidContractPeriod.FIELD)
                    .addConstraintViolation();
        }
        return !invalid;
    }
}
