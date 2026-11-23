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
import org.springframework.util.MultiValueMap;

import java.util.List;
import java.util.Set;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Slf4j
@Component
public class FleetProxyGuard {

    private static final Set<String> DOT_SEGMENTS = Set.of(".", "..");
    private static final Set<String> SEPARATORS = Set.of("/", "\\");
    private static final HttpMethod READ_METHOD = HttpMethod.GET;

    private final boolean multiTenancyEnabled;
    private final FleetEndpointMatcher allowedEndpoints;
    private final TenantIdProvider tenantIdProvider;

    public FleetProxyGuard(FleetProxyProperties properties, TenantIdProvider tenantIdProvider) {
        List<String> configuredEndpoints = properties.getAllowedEndpoints();
        this.multiTenancyEnabled = properties.isEnabled();
        this.allowedEndpoints = new FleetEndpointMatcher(configuredEndpoints);
        this.tenantIdProvider = tenantIdProvider;
    }

    public boolean shouldGuard(String toolId) {
        return multiTenancyEnabled && isFleet(toolId);
    }

    public void requireAllowed(String method, String toolPath) {
        if (!isAllowed(method, toolPath)) {
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

    private boolean isAllowed(String method, String toolPath) {
        HttpMethod httpMethod = HttpMethod.valueOf(method);
        if (!isRead(httpMethod)) {
            return false;
        }
        if (!hasPlainSegmentsOnly(toolPath)) {
            return false;
        }
        return allowedEndpoints.matches(httpMethod, toolPath);
    }

    private static boolean isRead(HttpMethod method) {
        return READ_METHOD.equals(method);
    }

    private static boolean isFleet(String toolId) {
        return FleetEndpointMatcher.FLEET_TOOL_ID.equals(toolId);
    }

    private static boolean hasPlainSegmentsOnly(String toolPath) {
        PathContainer container = PathContainer.parsePath(toolPath);
        return container.elements().stream()
                .filter(PathContainer.PathSegment.class::isInstance)
                .map(PathContainer.PathSegment.class::cast)
                .allMatch(FleetProxyGuard::isPlainSegment);
    }

    private static boolean isPlainSegment(PathContainer.PathSegment segment) {
        String value = segment.valueToMatch();
        MultiValueMap<String, String> parameters = segment.parameters();
        return !isDotSegment(value) && !hasSeparator(value) && parameters.isEmpty();
    }

    private static boolean isDotSegment(String value) {
        return DOT_SEGMENTS.contains(value);
    }

    private static boolean hasSeparator(String value) {
        return SEPARATORS.stream().anyMatch(value::contains);
    }
}
