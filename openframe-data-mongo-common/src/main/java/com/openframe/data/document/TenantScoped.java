package com.openframe.data.document;
public interface TenantScoped {
    String getTenantId();
    void setTenantId(String tenantId);
}
