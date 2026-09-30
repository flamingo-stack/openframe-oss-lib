package com.openframe.api.tenant;

import com.openframe.api.service.tenant.RequestTenantDomainProvider;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Optional;

/**
 * Reads the tenant domain the shared gateway stamped on the current HTTP request.
 * <p>
 * The header is trustworthy because the shared gateway removes it from every inbound request before injecting its own,
 * so it can only ever carry a value that gateway resolved - it looks the request's {@code Host} up as
 * {@code tenants.domain}, which is the same string the tenant record holds.
 * <p>
 * Absent outside a request (scheduled work, NATS consumers) and on requests that never passed the gateway, such as
 * actuator probes and local runs; {@code TenantDomainService} falls back to the tenant record for those.
 */
@Component
public class GatewayTenantDomainProvider implements RequestTenantDomainProvider {

    static final String TENANT_DOMAIN_HEADER = "X-Tenant-Domain";

    @Override
    public Optional<String> currentTenantDomain() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        if (!(attributes instanceof ServletRequestAttributes servletAttributes)) {
            return Optional.empty();
        }
        return Optional.ofNullable(servletAttributes.getRequest().getHeader(TENANT_DOMAIN_HEADER));
    }
}
