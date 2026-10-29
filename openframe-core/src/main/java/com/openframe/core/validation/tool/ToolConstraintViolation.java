package com.openframe.core.validation.tool;

import lombok.Value;
import lombok.experimental.Accessors;

import jakarta.validation.ConstraintValidatorContext;

import java.util.List;

/** Reports detected field errors together without stopping at the first error. */
@Value
@Accessors(fluent = true)
public class ToolConstraintViolation {

    private final String field;
    private final String message;

    public static boolean apply(ConstraintValidatorContext context, List<ToolConstraintViolation> violations) {
        if (violations.isEmpty()) {
            return true;
        }
        context.disableDefaultConstraintViolation();
        violations.forEach(violation -> violation.addTo(context));
        return false;
    }

    private void addTo(ConstraintValidatorContext context) {
        context.buildConstraintViolationWithTemplate(message).addPropertyNode(field).addConstraintViolation();
    }
}
