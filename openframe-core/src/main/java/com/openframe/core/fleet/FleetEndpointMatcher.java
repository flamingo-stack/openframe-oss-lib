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
import java.util.Objects;

public final class FleetEndpointMatcher {

    public static final String FLEET_TOOL_ID = "fleetmdm-server";

    private static final String ENTRY_SEPARATOR = "\\s+";
    private static final List<String> NO_ENTRIES = List.of();
    private static final List<PathPattern> NO_PATTERNS = List.of();

    private final Map<HttpMethod, List<PathPattern>> patternsByMethod;

    public FleetEndpointMatcher(List<String> entries) {
        List<String> configuredEntries = Objects.requireNonNullElse(entries, NO_ENTRIES);
        this.patternsByMethod = compile(configuredEntries);
    }

    public boolean matches(HttpMethod method, String path) {
        PathContainer container = PathContainer.parsePath(path);
        List<PathPattern> patterns = patternsByMethod.getOrDefault(method, NO_PATTERNS);
        return patterns.stream().anyMatch(pattern -> pattern.matches(container));
    }

    private static Map<HttpMethod, List<PathPattern>> compile(List<String> entries) {
        PathPatternParser parser = new PathPatternParser();
        Map<HttpMethod, List<PathPattern>> byMethod = new HashMap<>();
        for (String entry : entries) {
            String trimmedEntry = entry.trim();
            String[] parts = trimmedEntry.split(ENTRY_SEPARATOR, 2);
            if (parts.length != 2) {
                throw new IllegalArgumentException("Invalid Fleet endpoint entry (expected \"METHOD pattern\"): " + entry);
            }
            String methodName = parts[0].toUpperCase(Locale.ROOT);
            HttpMethod method = HttpMethod.valueOf(methodName);
            PathPattern pattern = parser.parse(parts[1]);
            byMethod.computeIfAbsent(method, ignored -> new ArrayList<>()).add(pattern);
        }
        return byMethod;
    }
}
