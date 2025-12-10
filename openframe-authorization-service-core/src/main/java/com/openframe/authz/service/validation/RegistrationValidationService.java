package com.openframe.authz.service.validation;

import com.openframe.data.repository.tenant.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import static java.util.Locale.ROOT;

@Service
@RequiredArgsConstructor
public class RegistrationValidationService {

    private final TenantRepository tenantRepository;

    public void ensureTenantDomainAvailable(String domain) {
        if (tenantRepository.existsByDomain(domain.toLowerCase(ROOT))) {
            throw new IllegalArgumentException("Tenant domain already exists");
        }
    }
}
