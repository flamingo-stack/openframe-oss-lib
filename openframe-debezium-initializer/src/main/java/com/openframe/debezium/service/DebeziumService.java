package com.openframe.debezium.service;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.debezium.dto.ConnectorStatus;
import com.openframe.debezium.naming.ConnectorNameStrategy;
import com.openframe.debezium.recovery.RecreationTracker;
import com.openframe.debezium.util.ConnectorSpecs;
import com.openframe.debezium.util.DebeziumLog;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
public class DebeziumService {

    private static final String PATH_CONNECTORS = "/connectors";
    private static final String PATH_CONFIG = "/config";
    private static final String PATH_STATUS = "/status";
    private static final String PATH_RESTART = "/restart";

    private final ConnectorNameStrategy nameStrategy;
    private final RecreationTracker recreationTracker;
    private RestTemplate restTemplate;

    @Autowired
    public DebeziumService(ConnectorNameStrategy nameStrategy,
                           @Autowired(required = false) RecreationTracker recreationTracker) {
        this.nameStrategy = nameStrategy;
        this.recreationTracker = recreationTracker;
    }

    @Value("${openframe.debezium.base-url}")
    private String debeziumUrl;
    @Value("${openframe.debezium.connect.connect-timeout:5s}")
    private Duration connectTimeout;
    @Value("${openframe.debezium.connect.read-timeout:30s}")
    private Duration readTimeout;
    private String connectorsBaseUrl;

    @PostConstruct
    public void init() {
        this.connectorsBaseUrl = debeziumUrl + PATH_CONNECTORS;
        this.restTemplate = new RestTemplateBuilder()
                .setConnectTimeout(connectTimeout)
                .setReadTimeout(readTimeout)
                .build();
    }

    public void createOrUpdateDebeziumConnector(Object[] debeziumConnectors) {
        if (debeziumConnectors == null) return;
        Arrays.stream(debeziumConnectors)
                .map(ConnectorSpecs::asMap)
                .filter(Objects::nonNull)
                .forEach(this::applyConnectorSpec);
    }

    private void applyConnectorSpec(Map<String, Object> spec) {
        String baseName = ConnectorSpecs.nameOf(spec);
        if (baseName == null) {
            log.warn("Skipping connector spec without 'name' field: {}", spec);
            return;
        }
        Map<String, Object> config = ConnectorSpecs.configOf(spec);

        log.info("Processing Debezium connector base='{}'", baseName);

        List<String> existing = listConnectors();
        if (!nameStrategy.hasAnyVersion(baseName, existing)) {
            createInitialVersion(baseName, config, existing);
            return;
        }

        // Base already has a version. Decide how to propagate the incoming config.
        if (nameStrategy.supportsRecreation()) {
            recreateOnConfigDrift(baseName, config, existing);
        } else {
            tryUpdateExistingIdentityConnector(baseName, config, existing);
        }
    }

    private void createInitialVersion(String baseName, Map<String, Object> config, List<String> existing) {
        String effectiveName = nameStrategy.resolveNextName(baseName, existing);
        try {
            createConnector(effectiveName, config);
        } catch (Exception e) {
            log.error("Failed to create connector '{}' (base='{}')", effectiveName, baseName, e);
        }
    }

    /**
     * Identity-strategy path: a connector with the exact base name already exists,
     * so push the latest config in place. PUT /connectors/{name}/config is
     * idempotent and overrides whatever was stored.
     */
    private void tryUpdateExistingIdentityConnector(String baseName, Map<String, Object> config, List<String> existing) {
        if (config == null || !existing.contains(baseName)) {
            return;
        }
        try {
            HttpEntity<Object> requestEntity = jsonEntity(ConnectorSpecs.configWithName(config, baseName));
            restTemplate.put(connectorConfigUrl(baseName), requestEntity);
            log.info("Connector '{}' config updated", baseName);
        } catch (Exception e) {
            log.error("Failed to update connector '{}' config", baseName, e);
        }
    }

    /**
     * Versioned-strategy path: compare the incoming config to whatever is currently
     * running under the latest version. If they match, do nothing. If they differ,
     * gate the recreate on {@link RecreationTracker} (when present) to prevent
     * register-job replay storms.
     *
     * <p>Special cases:
     * <ul>
     *   <li>{@code getConnectorConfig} returns null because Kafka Connect is
     *       transiently unreachable → skip (don't spuriously recreate). The
     *       distinction between "gone" (404) and "transient" is made inside
     *       {@code getConnectorConfig}.</li>
     *   <li>Rate-limit reached → skip with a warn; the connector keeps running
     *       under {@code currentName} until the window rolls.</li>
     * </ul>
     */
    private void recreateOnConfigDrift(String baseName, Map<String, Object> incomingConfig, List<String> existing) {
        Optional<String> currentNameOpt = nameStrategy.currentVersion(baseName, existing);
        if (currentNameOpt.isEmpty()) {
            log.warn("{} Versioned base '{}' has versions but currentVersion() empty — skipping",
                    DebeziumLog.PREFIX, baseName);
            return;
        }
        String currentName = currentNameOpt.get();
        Map<String, Object> currentConfig = getConnectorConfig(currentName);
        if (currentConfig == null) {
            log.warn("{} Cannot read current config for '{}' — skipping drift check to avoid spurious recreate",
                    DebeziumLog.PREFIX, currentName);
            return;
        }
        if (configsEquivalent(currentConfig, incomingConfig)) {
            log.info("{} Versioned config unchanged: base='{}' current='{}'", DebeziumLog.PREFIX, baseName, currentName);
            return;
        }
        if (recreationTracker != null && !recreationTracker.canRecreate(baseName)) {
            log.warn("{} Drift detected but rate-limit reached: base='{}' — deferring",
                    DebeziumLog.PREFIX, baseName);
            return;
        }
        String newName = nameStrategy.resolveNextName(baseName, existing);
        log.warn("{} Config drift detected — recreating: base='{}' current='{}' new='{}'",
                DebeziumLog.PREFIX, baseName, currentName, newName);
        if (recreationTracker != null) {
            try {
                recreationTracker.record(baseName);
            } catch (Exception e) {
                log.error("{} Drift recreate aborted — tracker record failed: base='{}'",
                        DebeziumLog.PREFIX, baseName, e);
                return;
            }
        }
        try {
            createConnector(newName, incomingConfig);
        } catch (Exception e) {
            log.error("{} Drift-driven recreation failed: base='{}' new='{}'", DebeziumLog.PREFIX, baseName, newName, e);
            return;
        }
        nameStrategy.staleVersions(baseName, newName, existing)
                .forEach(this::deleteConnector);
    }

    /**
     * Compare two connector-config maps for semantic equality. Kafka Connect's
     * {@code GET /config} returns all values as strings, but specs loaded from
     * Mongo may carry Integer/Boolean/etc. We stringify both sides for an
     * apples-to-apples compare and drop the {@code name} key (it always differs
     * between the running versioned name and the base in the incoming spec).
     */
    private boolean configsEquivalent(Map<String, Object> a, Map<String, Object> b) {
        if (a == null || b == null) return a == b;
        return normalisedForCompare(a).equals(normalisedForCompare(b));
    }

    private Map<String, String> normalisedForCompare(Map<String, Object> config) {
        Map<String, String> out = new HashMap<>();
        config.forEach((k, v) -> {
            if (ConnectorSpecs.KEY_NAME.equals(k) || v == null) return;
            out.put(k, String.valueOf(v));
        });
        return out;
    }

    /**
     * POST a new connector to Kafka Connect under the given effective name.
     * The supplied config map is shallow-copied with {@code name} overridden to match.
     */
    public void createConnector(String effectiveName, Map<String, Object> config) {
        Map<String, Object> payload = ConnectorSpecs.connectorPayload(effectiveName, config);
        ResponseEntity<String> response =
                restTemplate.postForEntity(connectorsBaseUrl, jsonEntity(payload), String.class);
        log.info("Connector '{}' created. Response: {}", effectiveName, response.getStatusCode());
    }

    /**
     * DELETE /connectors/{name}. Tolerates 404 (already gone).
     */
    public void deleteConnector(String name) {
        try {
            restTemplate.delete(connectorUrl(name));
            log.info("Connector '{}' deleted", name);
        } catch (HttpClientErrorException.NotFound e) {
            log.info("Connector '{}' already absent, nothing to delete", name);
        } catch (Exception e) {
            log.error("Failed to delete connector '{}'", name, e);
        }
    }

    /**
     * List all registered connectors. Returns empty list on transient failure —
     * callers that need to distinguish "no connectors" from "Kafka Connect down"
     * must guard their own logic (e.g. the health-check scheduler skips reconcile
     * when it expects connectors but receives an empty list).
     */
    @SuppressWarnings("unchecked")
    public List<String> listConnectors() {
        try {
            List<String> connectors = restTemplate.getForObject(connectorsBaseUrl, List.class);
            return connectors != null ? connectors : Collections.emptyList();
        } catch (Exception e) {
            log.error("Failed to list connectors", e);
            return Collections.emptyList();
        }
    }

    /**
     * Get connector status. Returns {@code null} when the connector is gone
     * (Kafka Connect 404 between iterations).
     */
    public ConnectorStatus getConnectorStatus(String connectorName) {
        try {
            return restTemplate.getForObject(connectorUrl(connectorName) + PATH_STATUS, ConnectorStatus.class);
        } catch (HttpClientErrorException.NotFound e) {
            return null;
        }
    }

    /**
     * Get the currently-deployed config of a connector. Returns {@code null} if
     * the connector is gone or Kafka Connect is unreachable.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getConnectorConfig(String connectorName) {
        try {
            return restTemplate.getForObject(connectorConfigUrl(connectorName), Map.class);
        } catch (HttpClientErrorException.NotFound e) {
            return null;
        } catch (Exception e) {
            log.error("Failed to read config for connector '{}'", connectorName, e);
            return null;
        }
    }

    /**
     * Restart connector and all failed tasks in a single call (KIP-745).
     */
    public void restartConnectorWithFailedTasks(String connectorName) {
        String url = UriComponentsBuilder.fromHttpUrl(connectorUrl(connectorName) + PATH_RESTART)
                .queryParam("includeTasks", "true")
                .queryParam("onlyFailed", "true")
                .build()
                .toUriString();
        restTemplate.postForEntity(url, jsonEntity(null), Void.class);
        log.info("Triggered KIP-745 restart for connector '{}' (includeTasks=true, onlyFailed=true)", connectorName);
    }

    /**
     * Extract expected base names from enabled IntegratedTool configurations.
     * Disabled tools are skipped — they must not be reconciled into Kafka Connect.
     */
    public Set<String> extractExpectedConnectorNames(List<IntegratedTool> tools) {
        return tools.stream()
                .filter(IntegratedTool::isEnabled)
                .flatMap(ConnectorSpecs::specStreamOf)
                .map(ConnectorSpecs::nameOf)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
    }

    /**
     * Recreate connectors that are expected (in MongoDB) but missing from Kafka Connect.
     * Matching honours the active {@link ConnectorNameStrategy} — a versioned strategy
     * considers a base "present" as long as any {@code base_vN} exists.
     */
    public void reconcileMissingConnectors(List<IntegratedTool> tools, Set<String> missingNames) {
        tools.stream()
                .filter(IntegratedTool::isEnabled)
                .forEach(tool -> ConnectorSpecs.specStreamOf(tool)
                        .filter(spec -> missingNames.contains(ConnectorSpecs.nameOf(spec)))
                        .forEach(spec -> {
                            log.warn("Recreating missing connector base='{}' from IntegratedTool '{}'",
                                    ConnectorSpecs.nameOf(spec), tool.getName());
                            applyConnectorSpec(spec);
                        }));
    }

    /**
     * Prune connectors in Kafka Connect down to one canonical version per known
     * base, deleting:
     * <ul>
     *   <li><b>orphans</b> — connectors whose base name maps to no known tool spec
     *       (e.g. an old tenant-prefixed naming scheme the active strategy no
     *       longer recognises): reconcile never recreates them, recovery keeps
     *       restarting them, and they may hold replication slots that block the
     *       canonical connector;</li>
     *   <li><b>stale versions</b> — older {@code <base>_vN} of a known base left
     *       behind by an interrupted recreate; only the current (highest) version
     *       is kept.</li>
     * </ul>
     * Base-name and version resolution honour the active {@link ConnectorNameStrategy}
     * (a no-op for stale-version pruning under the identity strategy).
     *
     * <p>{@code knownBaseNames} must be derived from ALL tools (enabled and
     * disabled) — a temporarily-disabled tool's connector is not an orphan. The
     * caller must guarantee {@code knownBaseNames} and {@code actualConnectors}
     * are non-empty to avoid mass-deletion on a transient outage.
     */
    public void deleteOrphanedConnectors(Set<String> knownBaseNames, List<String> actualConnectors) {
        actualConnectors.stream()
                .filter(name -> !knownBaseNames.contains(nameStrategy.extractBaseName(name)))
                .forEach(name -> {
                    log.warn("{} Deleting orphaned connector '{}' (base='{}') — no matching tool spec",
                            DebeziumLog.PREFIX, name, nameStrategy.extractBaseName(name));
                    deleteConnector(name);
                });

        // Collapse each known base to its current version, removing stale older
        // versions a prior recreate failed to clean up. Resolved against the
        // pre-deletion snapshot — orphans removed above share no base here.
        knownBaseNames.forEach(base -> nameStrategy.currentVersion(base, actualConnectors)
                .ifPresent(current -> nameStrategy.staleVersions(base, current, actualConnectors)
                        .forEach(stale -> {
                            log.warn("{} Deleting stale connector version '{}' (base='{}', keeping '{}')",
                                    DebeziumLog.PREFIX, stale, base, current);
                            deleteConnector(stale);
                        })));
    }

    private String connectorUrl(String name) {
        return UriComponentsBuilder.fromHttpUrl(connectorsBaseUrl)
                .pathSegment(name)
                .build()
                .toUriString();
    }

    private String connectorConfigUrl(String name) {
        return connectorUrl(name) + PATH_CONFIG;
    }

    private HttpEntity<Object> jsonEntity(Object body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, headers);
    }
}
