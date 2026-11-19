package com.openframe.core.fleet;

import org.springframework.http.HttpMethod;
import org.springframework.http.server.PathContainer;
import org.springframework.web.util.pattern.PathPattern;
import org.springframework.web.util.pattern.PathPatternParser;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class FleetEndpointMatcher {

    public static final String FLEET_TOOL_ID = "fleetmdm-server";

    private final Map<HttpMethod, List<PathPattern>> patternsByMethod;

    public FleetEndpointMatcher(List<String> entries) {
        this.patternsByMethod = compile(entries);
    }

    public boolean matches(HttpMethod method, String path) {
        PathContainer container = PathContainer.parsePath(path);
        return patternsByMethod.getOrDefault(method, List.of()).stream()
                .anyMatch(pattern -> pattern.matches(container));
    }

    private static Map<HttpMethod, List<PathPattern>> compile(List<String> entries) {
        Map<HttpMethod, List<PathPattern>> byMethod = new HashMap<>();
        if (entries == null) {
            return byMethod;
        }
        PathPatternParser parser = new PathPatternParser();
        for (String entry : entries) {
            String[] parts = entry.trim().split("\\s+", 2);
            if (parts.length != 2) {
                throw new IllegalArgumentException("Invalid Fleet endpoint entry (expected \"METHOD pattern\"): " + entry);
            }
            HttpMethod method = HttpMethod.valueOf(parts[0].toUpperCase(Locale.ROOT));
            byMethod.computeIfAbsent(method, m -> new ArrayList<>()).add(parser.parse(parts[1]));
        }
        return byMethod;
    }
}
