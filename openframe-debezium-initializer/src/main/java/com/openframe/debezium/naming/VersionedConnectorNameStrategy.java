package com.openframe.debezium.naming;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Versioned connector-naming strategy. Each connector is created under
 * {@code <baseName>_vN}. The version counter is only advanced when the recovery
 * manager has to recreate an unrecoverable connector
 * ({@link com.openframe.debezium.service.ConnectorRecoveryManager}), or when
 * {@code DebeziumService} detects config drift on re-registration. After
 * successful creation of {@code _v(N+1)} the older versions are removed, leaving
 * exactly one active version per base name.
 *
 * <p>Activated by {@code openframe.debezium.recovery.recreation.enabled=true} —
 * the same flag that enables the {@code MongoRecreationTracker}, since versioned
 * naming exists precisely to make recreate-based recovery safe: versioned names
 * give a clean Kafka Connect offset namespace, so a stuck connector can be
 * recreated without colliding with the old name's retained offsets. Used by the
 * shared SaaS cluster and by any per-tenant cluster that opts in.
 */
@Component
@Primary
@ConditionalOnProperty(name = "openframe.debezium.recovery.recreation.enabled", havingValue = "true")
public class VersionedConnectorNameStrategy implements ConnectorNameStrategy {

    private static final String VERSION_SEPARATOR = "_v";
    private static final Pattern VERSION_SUFFIX =
            Pattern.compile("^(?<base>.+?)" + Pattern.quote(VERSION_SEPARATOR) + "(?<ver>\\d+)$");
    private static final int LEGACY_VERSION = 0;
    private static final int INITIAL_VERSION = 1;

    @Override
    public boolean supportsRecreation() {
        return true;
    }

    @Override
    public boolean matchesBase(String baseName, String connectorName) {
        return parse(baseName, connectorName).isPresent();
    }

    @Override
    public Optional<String> currentVersion(String baseName, List<String> existing) {
        return existing.stream()
                .filter(c -> matchesBase(baseName, c))
                .max(Comparator.comparingInt(this::versionOf));
    }

    @Override
    public String extractBaseName(String connectorName) {
        if (connectorName == null) return null;
        Matcher m = VERSION_SUFFIX.matcher(connectorName);
        return m.matches() ? m.group("base") : connectorName;
    }

    @Override
    public String resolveNextName(String baseName, List<String> existing) {
        int next = existing.stream()
                .filter(c -> matchesBase(baseName, c))
                .mapToInt(this::versionOf)
                .max()
                .orElse(0) + 1;
        return baseName + VERSION_SEPARATOR + Math.max(next, INITIAL_VERSION);
    }

    /**
     * @return matcher when {@code connectorName} is either {@code baseName} or
     *         {@code baseName_v<digits>}; {@code Optional.empty()} otherwise.
     */
    private Optional<Matcher> parse(String baseName, String connectorName) {
        if (baseName == null || connectorName == null) return Optional.empty();
        if (connectorName.equals(baseName)) {
            // Legacy match — return any matcher just as a non-empty marker.
            return Optional.of(VERSION_SUFFIX.matcher(connectorName));
        }
        Matcher m = VERSION_SUFFIX.matcher(connectorName);
        return m.matches() && baseName.equals(m.group("base")) ? Optional.of(m) : Optional.empty();
    }

    private int versionOf(String connectorName) {
        Matcher m = VERSION_SUFFIX.matcher(connectorName);
        if (!m.matches()) return LEGACY_VERSION;
        try {
            return Integer.parseInt(m.group("ver"));
        } catch (NumberFormatException ignored) {
            return LEGACY_VERSION;
        }
    }
}
