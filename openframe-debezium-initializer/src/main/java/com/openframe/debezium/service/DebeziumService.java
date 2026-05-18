package com.openframe.debezium.service;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.debezium.dto.ConnectorStatus;
import com.openframe.debezium.naming.ConnectorNameStrategy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Slf4j
@Service
public class DebeziumService {

    private final RestTemplate restTemplate = new RestTemplate();
    private final ConnectorNameStrategy nameStrategy;

    @Value("${openframe.debezium.base-url}")
    private String debeziumUrl;
    private String debeziumConnectorCreateUrl;

    @Autowired
    public DebeziumService(ConnectorNameStrategy nameStrategy) {
        this.nameStrategy = nameStrategy;
    }

    public void createOrUpdateDebeziumConnector(Object[] debeziumConnectors) {
        if (debeziumConnectors == null) return;
        Arrays.stream(debeziumConnectors)
                .map(this::asMap)
                .forEach(this::applyConnectorSpec);
    }

    private void applyConnectorSpec(Map<String, Object> spec) {
        String baseName = (String) spec.get("name");
        Map<String, Object> config = asMap(spec.get("config"));
        log.info("Processing Debezium connector base='{}'", baseName);

        List<String> existing = listConnectors();
        if (nameStrategy.hasAnyVersion(baseName, existing)) {
            log.info("Connector for base '{}' already present — skipping initial creation (strategy={})",
                    baseName, nameStrategy.getClass().getSimpleName());
            tryUpdateExistingIdentityConnector(baseName, config, existing);
            return;
        }

        String effectiveName = nameStrategy.resolveNextName(baseName, existing);
        try {
            createConnector(effectiveName, config);
        } catch (Exception e) {
            log.error("Failed to create connector '{}' (base='{}')", effectiveName, baseName, e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        return value == null ? null : (Map<String, Object>) value;
    }

    /**
     * For backward compatibility with the identity flow: if a connector with the exact base name
     * already exists, push the latest config (matches pre-refactor behavior of PUT /config).
     * Versioned strategy never reaches this branch because shouldCreateInitial returns true only
     * when no version exists at all.
     */
    private void tryUpdateExistingIdentityConnector(String baseName, Map<String, Object> config, List<String> existing) {
        if (config == null || !existing.contains(baseName)) {
            return;
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            Map<String, Object> configWithName = new HashMap<>(config);
            configWithName.put("name", baseName);
            HttpEntity<Object> requestEntity = new HttpEntity<>(configWithName, headers);
            restTemplate.put(getDebeziumConnectorConfigUrl(baseName), requestEntity);
            log.info("Connector '{}' config updated", baseName);
        } catch (Exception e) {
            log.error("Failed to update connector '{}' config", baseName, e);
        }
    }

    /**
     * POST a new connector to Kafka Connect under the given effective name.
     * The supplied config map is shallow-copied with {@code name} overridden to match.
     */
    public void createConnector(String effectiveName, Map<String, Object> config) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> configWithName = config == null ? new HashMap<>() : new HashMap<>(config);
        configWithName.put("name", effectiveName);

        Map<String, Object> payload = new HashMap<>();
        payload.put("name", effectiveName);
        payload.put("config", configWithName);

        HttpEntity<Object> requestEntity = new HttpEntity<>(payload, headers);
        ResponseEntity<String> response =
                restTemplate.postForEntity(getDebeziumConnectorCreateUrl(), requestEntity, String.class);
        log.info("Connector '{}' created. Response: {}", effectiveName, response.getStatusCode());
    }

    /**
     * DELETE /connectors/{name}. Tolerates 404 (already gone).
     */
    public void deleteConnector(String name) {
        try {
            restTemplate.delete(getDebeziumConnectorUrl(name));
            log.info("Connector '{}' deleted", name);
        } catch (HttpClientErrorException.NotFound e) {
            log.info("Connector '{}' already absent, nothing to delete", name);
        } catch (Exception e) {
            log.error("Failed to delete connector '{}'", name, e);
        }
    }

    private String getDebeziumConnectorCreateUrl() {
        if (debeziumConnectorCreateUrl == null) {
            debeziumConnectorCreateUrl = this.debeziumUrl + "/connectors";
        }
        return debeziumConnectorCreateUrl;
    }

    private String getDebeziumConnectorUrl(String name) {
        return "%s/%s".formatted(getDebeziumConnectorCreateUrl(), name);
    }

    private String getDebeziumConnectorConfigUrl(String name) {
        return "%s/config".formatted(getDebeziumConnectorUrl(name));
    }

    /**
     * List all registered connectors.
     */
    @SuppressWarnings("unchecked")
    public List<String> listConnectors() {
        try {
            List<String> connectors = restTemplate.getForObject(getDebeziumConnectorCreateUrl(), List.class);
            return connectors != null ? connectors : Collections.emptyList();
        } catch (Exception e) {
            log.error("Failed to list connectors", e);
            return Collections.emptyList();
        }
    }

    /**
     * Get connector status including task states.
     */
    public ConnectorStatus getConnectorStatus(String connectorName) {
        String url = getDebeziumConnectorUrl(connectorName) + "/status";
        return restTemplate.getForObject(url, ConnectorStatus.class);
    }

    /**
     * Restart connector and all failed tasks in a single call (KIP-745).
     * POST /connectors/{name}/restart?includeTasks=true&onlyFailed=true
     */
    public void restartConnectorWithFailedTasks(String connectorName) {
        String url = getDebeziumConnectorUrl(connectorName) + "/restart?includeTasks=true&onlyFailed=true";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Void> entity = new HttpEntity<>(headers);
        restTemplate.postForEntity(url, entity, Void.class);
        log.info("Triggered KIP-745 restart for connector '{}' (includeTasks=true, onlyFailed=true)", connectorName);
    }

    /**
     * Extract expected base names from IntegratedTool configurations.
     */
    public Set<String> extractExpectedConnectorNames(List<IntegratedTool> tools) {
        return tools.stream()
                .flatMap(this::specStreamOf)
                .map(spec -> (String) spec.get("name"))
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
    }

    /**
     * Recreate connectors that are expected (in MongoDB) but missing from Kafka Connect.
     * Matching honours the active {@link ConnectorNameStrategy} — a versioned strategy
     * considers a base "present" as long as any {@code base_vN} exists.
     */
    public void reconcileMissingConnectors(List<IntegratedTool> tools, Set<String> missingNames) {
        tools.forEach(tool -> specStreamOf(tool)
                .filter(spec -> missingNames.contains((String) spec.get("name")))
                .forEach(spec -> {
                    log.warn("Recreating missing connector base='{}' from IntegratedTool '{}'",
                            spec.get("name"), tool.getName());
                    createOrUpdateDebeziumConnector(new Object[]{spec});
                }));
    }

    private Stream<Map<String, Object>> specStreamOf(IntegratedTool tool) {
        Object[] connectors = tool.getDebeziumConnectors();
        return connectors == null ? Stream.empty() : Arrays.stream(connectors).map(this::asMap);
    }
}
