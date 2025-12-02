package com.openframe.api.service;

import com.openframe.data.repository.tenant.SSOPerTenantConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class DomainValidationService {

    private final SSOPerTenantConfigRepository ssoPerTenantConfigRepository;

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
        //TODO call to internal api
       //TODO  throw IllegalArgumentException in case of exist true
    }

    public void validateGenericPublicDomain(List<String> domains) {
        List<String> found = domains.stream()
                .filter(GENERIC_PUBLIC_DOMAINS::contains)
                .toList();

        if (!found.isEmpty()) {
            throw new IllegalArgumentException("Generic domains not allowed: " + found);
        }
    }
}


