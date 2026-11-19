package com.openframe.core.fleet;

import org.springframework.http.HttpMethod;

import java.util.List;

public final class FleetEndpointMatcher {

    public static final String FLEET_TOOL_ID = "fleetmdm-server";

    public FleetEndpointMatcher(List<String> entries) {
    }

    public boolean matches(HttpMethod method, String path) {
        throw new UnsupportedOperationException("not implemented");
    }
}
