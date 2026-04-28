package com.openframe.data.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * OSS default: returns the TENANT_ID env value directly.
 * Replaced by SaasTenantIdProvider (@Primary) in SaaS deployments.
 */
@Slf4j
@Service
public class DefaultTenantIdProvider implements TenantIdProvider {

    @Value("${TENANT_ID:oss}")
    private String tenantId;

    @Override
    public String getTenantId() {
        return tenantId;
    }
}
