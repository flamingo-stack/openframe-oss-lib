package com.openframe.debezium.naming;

import java.util.List;
import java.util.stream.Stream;

/**
 * Strategy for resolving connector names and recognising versioned variants.
 * Default implementation is {@link IdentityConnectorNameStrategy} — name is used
 * as-is. SaaS shared cluster overrides with a versioned strategy
 * ({@code _v1}, {@code _v2}, …).
 */
public interface ConnectorNameStrategy {

    /**
     * True if {@code connectorName} is either {@code baseName} itself or a
     * versioned form of it (e.g. {@code baseName_v3}).
     */
    boolean matchesBase(String baseName, String connectorName);

    /**
     * Strip the version suffix if present and return the base name.
     */
    String extractBaseName(String connectorName);

    /**
     * Effective Kafka Connect name to use when creating (or recreating) a
     * connector for the given base. Identity → {@code baseName}; versioned →
     * {@code baseName_v(max+1)}.
     */
    String resolveNextName(String baseName, List<String> existing);

    /**
     * True if at least one connector matching {@code baseName} is already
     * present in {@code existing}. Used as runaway-protection on initial
     * creation and reconcile.
     */
    default boolean hasAnyVersion(String baseName, List<String> existing) {
        return existing.stream().anyMatch(c -> matchesBase(baseName, c));
    }

    /**
     * Connectors matching {@code baseName} other than {@code currentName} —
     * the candidates for deletion after a successful recreate.
     */
    default Stream<String> staleVersions(String baseName, String currentName, List<String> existing) {
        return existing.stream()
                .filter(c -> matchesBase(baseName, c) && !c.equals(currentName));
    }
}
