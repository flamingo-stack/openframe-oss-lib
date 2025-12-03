package com.openframe.api.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class DomainValidationService {

    private final DomainExistenceValidator domainExistenceValidator;

    private static final Set<String> GENERIC_PUBLIC_DOMAINS = Set.of(
            "gmail.com",
            "googlemail.com",
            "yahoo.com",
            "outlook.com",
            "hotmail.com",
            "live.com",
            "msn.com",
            "icloud.com",
            "me.com",
            "mac.com",
            "aol.com",
            "gmx.com",
            "proton.me",
            "protonmail.com",
            "fastmail.com"
    );

    public void validateExists(List<String> domains) {
        if (domains.isEmpty()) {
            return;
        }
        boolean anyExists = domainExistenceValidator.anyExists(domains);
        if (anyExists) {
            throw new IllegalArgumentException("One or more domains already exist in the system");
        }
    }

    public void validateGenericPublicDomain(List<String> domains) {
        if (domains.isEmpty()) {
            return;
        }
        List<String> found = domains.stream()
                .filter(GENERIC_PUBLIC_DOMAINS::contains)
                .toList();

        if (!found.isEmpty()) {
            throw new IllegalArgumentException("Generic domains not allowed: " + found);
        }
    }
}
