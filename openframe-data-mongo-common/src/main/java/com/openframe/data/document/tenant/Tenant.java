package com.openframe.data.document.tenant;

import lombok.*;
import lombok.experimental.SuperBuilder;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

import static java.util.UUID.randomUUID;

/**
 * Tenant document for multi-tenant architecture
 * Each tenant represents an organization/company using OpenFrame
 */
@Data
@SuperBuilder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "tenants")
public class Tenant {

    public static final String DISPLAY_ID_INDEX = "tenants_display_id_unique";

    @Id
    private String id;

    /**
     * Tenant name (organization name).
     * Used primarily for display and identification.
     */
    @Indexed
    private String name;

    /**
     * Tenant domain (e.g. company.openframe.io)
     * Used for subdomain-based routing
     */
    @Indexed(unique = true)
    private String domain;

    /**
     * Public reference of the tenant ({@link TenantDisplayId}), shown where the id and domain must not be.
     * Sparse-unique: tenants created before the field are given one by a backfill. Same index name as the one
     * {@code MongoIndexConfig} ensures, so the two stay idempotent.
     */
    @Indexed(unique = true, sparse = true, name = DISPLAY_ID_INDEX)
    private String displayId;

    /**
     * Tenant website URL (e.g. https://company.com). Free-form, editable via tenant-info CRUD.
     */
    private String website;

    /**
     * Owner user ID (first registered user becomes owner)
     */
    private String ownerId;

    /**
     * Tenant status
     */
    @Builder.Default
    private TenantStatus status = TenantStatus.ACTIVE;

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