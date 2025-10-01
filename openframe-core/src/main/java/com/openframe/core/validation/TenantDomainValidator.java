package com.openframe.core.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import static com.openframe.core.util.SlugUtil.toSlug;

@Component
public class TenantDomainValidator implements ConstraintValidator<TenantDomain, String> {

    @Value("${openframe.tenancy.base-domain:}")
    private String baseDomain;

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null) {
            return false;
        }
        String candidate = value.trim().toLowerCase();
        if (candidate.isEmpty()) {
            return false;
        }

        if (!candidate.endsWith(baseDomain)) {
            return false;
        }

        String slugPart = candidate.substring(0, candidate.length() - baseDomain.length());
        if (slugPart.endsWith(".")) slugPart = slugPart.substring(0, slugPart.length() - 1);

        if (slugPart.isEmpty() || slugPart.contains(".")) return false;
        return toSlug(slugPart).equals(slugPart);
    }
}
