package com.openframe.data.document.auth;

import lombok.*;
import lombok.experimental.SuperBuilder;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;

import java.time.LocalDateTime;

import static java.util.UUID.randomUUID;

/**
 * Tenant document for multi-tenant architecture
 * Each tenant represents an organization/company using OpenFrame
 */
@Data
@SuperBuilder(toBuilder = true)
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
public class Tenant extends CoreTenant{

    /**
     * Owner user ID (first registered user becomes owner)
     */
    private String ownerId;

    /**
     * Tenant status
     */
    @Builder.Default
    private TenantStatus status = TenantStatus.ACTIVE;

    /**
     * Tenant plan (for future use)
     */
    @Builder.Default
    private TenantPlan plan = TenantPlan.FREE;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    /**
     * Generate a new tenant ID using UUID
     */
    public static String generateTenantId() {
        return randomUUID().toString();
    }

    /**
     * Check if tenant is active
     */
    public boolean isActive() {
        return status == TenantStatus.ACTIVE;
    }
}