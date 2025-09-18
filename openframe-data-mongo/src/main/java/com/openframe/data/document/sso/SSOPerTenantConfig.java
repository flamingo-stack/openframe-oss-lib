package com.openframe.data.document.sso;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;

import java.time.LocalDateTime;

/**
 * SSO per-tenant configuration that inherits base SSOConfig (provider/client credentials, enabled)
 * and adds tenant-specific linkage and timestamps.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
public class SSOPerTenantConfig extends SSOConfig {
    /**
     * Tenant ID this SSO configuration belongs to
     */
    @Indexed(unique = true, sparse = true)
    private String tenantId;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}
