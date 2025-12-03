package com.openframe.api.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConditionalOnMissingBean(value = DomainExistenceValidator.class, ignored = DefaultDomainExistenceValidator.class)
public class DefaultDomainExistenceValidator implements DomainExistenceValidator {
    @Override
    public boolean anyExists(List<String> domains) {
        // Default lib behavior: do not block by existence (SaaS tenant overrides this)
        return false;
    }
}


