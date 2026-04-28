package com.openframe.data.document.tenant;

import com.openframe.data.document.sso.SSOConfig;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;

import java.time.LocalDateTime;

/**
 * SSO per-tenant configuration that inherits base SSOConfig (including tenantId from TenantScoped)
 * and adds SaaS-specific timestamps.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
public class SSOPerTenantConfig extends SSOConfig {

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}

