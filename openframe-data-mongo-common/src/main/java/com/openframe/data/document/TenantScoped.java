package com.openframe.data.document;

/**
 * Marker for documents whose data is partitioned by tenantId.
 *
 * On saas-tenant pods (where openframe.tenant-isolation.enabled=true), entities implementing
 * this interface are auto-stamped with the pod's tenantId on save and have a tenantId
 * criterion appended to repository/template queries.
 *
 * Shared/management pods do not enable the isolation framework — they read/write across
 * tenants intentionally and are responsible for setting the right tenantId themselves.
 */
public interface TenantScoped {

    String getTenantId();

    void setTenantId(String tenantId);
}
