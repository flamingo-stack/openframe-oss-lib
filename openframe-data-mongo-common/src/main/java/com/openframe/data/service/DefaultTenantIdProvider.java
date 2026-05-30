package com.openframe.data.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@ConditionalOnMissingBean(TenantIdProvider.class)
public class DefaultTenantIdProvider implements TenantIdProvider {

    @Value("${TENANT_ID:oss}")
    private String tenantId;

    @Override
    public String getTenantId() {
        return tenantId;
    }
}
