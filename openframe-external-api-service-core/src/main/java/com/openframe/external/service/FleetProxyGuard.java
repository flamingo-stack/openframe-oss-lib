package com.openframe.external.service;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.ForbiddenException;
import com.openframe.core.exception.InternalException;
import com.openframe.core.fleet.FleetEndpointMatcher;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.external.config.FleetProxyProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpMethod;
import org.springframework.http.server.PathContainer;
import org.springframework.stereotype.Component;

import java.util.Set;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Slf4j
@Component
public class FleetProxyGuard {

    private static final Set<String> DOT_SEGMENTS = Set.of(".", "..");

    private final boolean multiTenancyEnabled;
    private final FleetEndpointMatcher allowedEndpoints;
    private final TenantIdProvider tenantIdProvider;

    public FleetProxyGuard(FleetProxyProperties properties, TenantIdProvider tenantIdProvider) {
        this.multiTenancyEnabled = properties.isEnabled();
        this.allowedEndpoints = new FleetEndpointMatcher(properties.getAllowedEndpoints());
        this.tenantIdProvider = tenantIdProvider;
    }

    public boolean appliesTo(String toolId) {
        return multiTenancyEnabled && FleetEndpointMatcher.FLEET_TOOL_ID.equals(toolId);
    }

    public void requireAllowed(String method, String toolPath) {
        if (!hasPlainSegmentsOnly(toolPath) || !allowedEndpoints.matches(HttpMethod.valueOf(method), toolPath)) {
            log.warn("Fleet endpoint not allowed for API keys: {} {}", method, toolPath);
            throw new ForbiddenException(ErrorCode.ENDPOINT_NOT_ALLOWED,
                    "Fleet endpoint not allowed: " + method + " " + toolPath);
        }
    }

    public String tenantId() {
        String tenantId = tenantIdProvider.getTenantId();
        if (isBlank(tenantId)) {
            throw new InternalException("No tenant id for the Fleet request");
        }
        return tenantId;
    }

    private static boolean hasPlainSegmentsOnly(String toolPath) {
        return PathContainer.parsePath(toolPath).elements().stream()
                .filter(PathContainer.PathSegment.class::isInstance)
                .map(PathContainer.PathSegment.class::cast)
                .allMatch(FleetProxyGuard::isPlainSegment);
    }

    private static boolean isPlainSegment(PathContainer.PathSegment segment) {
        String value = segment.valueToMatch();
        return !DOT_SEGMENTS.contains(value)
                && !value.contains("/")
                && !value.contains("\\")
                && segment.parameters().isEmpty();
    }
}
