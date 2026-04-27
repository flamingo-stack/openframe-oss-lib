package com.openframe.debezium.service;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.debezium.dto.ConnectorStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Slf4j
@Service
public class DebeziumService {

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${openframe.debezium.base-url}")
    private String debeziumUrl;
    private String debeziumConnectorCreateUrl;

    public void createOrUpdateDebeziumConnector(Object[] debeziumConnectors) {
        if (debeziumConnectors == null) return;

        for (Object debeziumConnector : debeziumConnectors) {
            Map<String, Object> connectorMap = (Map<String, Object>) debeziumConnector;
            String name = (String) connectorMap.get("name");

            log.info("Processing Debezium connector: {}", name);

            String connectorUrl = getDebeziumConnectorStatusUrl(name);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            try {
                ResponseEntity<String> getResponse = restTemplate.getForEntity(connectorUrl, String.class);
                if (getResponse.getStatusCode().is2xxSuccessful()) {
                    log.info("Connector '{}' already exists — updating config...", name);
                    HttpEntity<Object> requestEntity = new HttpEntity<>(connectorMap.get("config"), headers);
                    restTemplate.put(getDebeziumConnectorConfigUrl(name), requestEntity);
                    log.info("Connector '{}' updated successfully", name);
                    continue;
                }
            } catch (HttpClientErrorException.NotFound e) {
                log.info("Connector '{}' not found — creating new one", name);
            } catch (Exception e) {
                log.error("Error checking connector '{}'", name, e);
                continue;
            }
            try {
                HttpEntity<Object> requestEntity = new HttpEntity<>(debeziumConnector, headers);
                ResponseEntity<String> response =
                        restTemplate.postForEntity(getDebeziumConnectorCreateUrl(), requestEntity, String.class);
                log.info("Connector '{}' created. Response: {}", name, response.getStatusCode());
            } catch (Exception e) {
                log.error("Failed to create connector '{}'", name, e);
            }
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

    private String getDebeziumConnectorStatusUrl(String name) {
        return "%s/status".formatted(getDebeziumConnectorUrl(name));
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
     * Extract expected connector names from IntegratedTool configurations.
     */
    @SuppressWarnings("unchecked")
    public Set<String> extractExpectedConnectorNames(List<IntegratedTool> tools) {
        Set<String> names = new HashSet<>();
        for (IntegratedTool tool : tools) {
            Object[] connectors = tool.getDebeziumConnectors();
            if (connectors != null) {
                for (Object connector : connectors) {
                    Map<String, Object> map = (Map<String, Object>) connector;
                    String name = (String) map.get("name");
                    if (name != null) {
                        names.add(name);
                    }
                }
            }
        }
        return names;
    }

    /**
     * Recreate connectors that are expected (in MongoDB) but missing from Kafka Connect.
     */
    @SuppressWarnings("unchecked")
    public void reconcileMissingConnectors(List<IntegratedTool> tools, Set<String> missingNames) {
        for (IntegratedTool tool : tools) {
            Object[] connectors = tool.getDebeziumConnectors();
            if (connectors == null) continue;
            for (Object connector : connectors) {
                Map<String, Object> map = (Map<String, Object>) connector;
                String name = (String) map.get("name");
                if (name != null && missingNames.contains(name)) {
                    log.warn("Recreating missing connector '{}' from IntegratedTool '{}'", name, tool.getName());
                    createOrUpdateDebeziumConnector(new Object[]{connector});
                }
            }
        }
    }
}
