package com.openframe.external.service;

import com.openframe.data.service.TenantIdProvider;
import com.openframe.external.config.FleetProxyProperties;
import org.springframework.stereotype.Component;

@Component
public class FleetProxyGuard {

    public FleetProxyGuard(FleetProxyProperties properties, TenantIdProvider tenantIdProvider) {
    }

    public boolean appliesTo(String toolId) {
        throw new UnsupportedOperationException("not implemented");
    }

    public void requireAllowed(String method, String toolPath) {
        throw new UnsupportedOperationException("not implemented");
    }

    public String tenantId() {
        throw new UnsupportedOperationException("not implemented");
    }
}
