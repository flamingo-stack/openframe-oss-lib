package com.openframe.gateway.upstream;

import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Holds every {@link ToolUpstreamResolver} bean and dispatches by toolId.
 *
 * Spring injects all {@link ToolUpstreamResolver} beans via the constructor.
 * Resolvers that return a non-empty {@link ToolUpstreamResolver#supportsToolId()}
 * are registered as the strategy for that specific toolId. Exactly one resolver
 * must return {@link java.util.Optional#empty()} — that is the default fallback,
 * used when no tool-specific resolver matches.
 *
 * Wiring is validated at construction: duplicate toolIds and missing/duplicate
 * defaults cause startup to fail fast.
 */
@Component
public class ToolUpstreamResolverRegistry {

    private final Map<String, ToolUpstreamResolver> byToolId;
    private final ToolUpstreamResolver fallback;

    public ToolUpstreamResolverRegistry(List<ToolUpstreamResolver> resolvers) {
        Map<String, ToolUpstreamResolver> map = new HashMap<>();
        ToolUpstreamResolver defaultResolver = null;
        for (ToolUpstreamResolver resolver : resolvers) {
            var supported = resolver.supportsToolId();
            if (supported.isEmpty()) {
                if (defaultResolver != null) {
                    throw new IllegalStateException(
                            "Multiple default ToolUpstreamResolver beans registered: "
                                    + defaultResolver.getClass().getName() + " and "
                                    + resolver.getClass().getName());
                }
                defaultResolver = resolver;
                continue;
            }
            ToolUpstreamResolver existing = map.put(supported.get(), resolver);
            if (existing != null) {
                throw new IllegalStateException(
                        "Duplicate ToolUpstreamResolver registered for toolId="
                                + supported.get() + ": " + existing.getClass().getName()
                                + " and " + resolver.getClass().getName());
            }
        }
        if (defaultResolver == null) {
            throw new IllegalStateException(
                    "No default ToolUpstreamResolver registered (a resolver returning empty supportsToolId)");
        }
        this.byToolId = Map.copyOf(map);
        this.fallback = defaultResolver;
    }

    /**
     * Returns the resolver for the given toolId, or the default fallback if no
     * tool-specific resolver is registered.
     */
    public ToolUpstreamResolver resolve(String toolId) {
        return byToolId.getOrDefault(toolId, fallback);
    }
}
