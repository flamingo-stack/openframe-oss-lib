package com.openframe.management.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import com.openframe.management.dto.debezium.ConnectorStatus;
import java.util.Collections;
import java.util.List;
import java.util.Map;

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

            String connectorUrl = getDebeziumConnectorUrl(name);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            try {
                ResponseEntity<String> getResponse = restTemplate.getForEntity(connectorUrl, String.class);
                if (getResponse.getStatusCode().is2xxSuccessful()) {
                    log.info("Connector '{}' already exists — updating config...", name);
                    HttpEntity<Object> requestEntity = new HttpEntity<>(connectorMap.get("config"), headers);
                    restTemplate.put(connectorUrl + "/config", requestEntity);
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
     * Restart a specific task of a connector.
     */
    public void restartTask(String connectorName, int taskId) {
        String url = getDebeziumConnectorUrl(connectorName) + "/tasks/" + taskId + "/restart";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Void> entity = new HttpEntity<>(headers);
        restTemplate.postForEntity(url, entity, Void.class);
        log.info("Restarted task {} for connector {}", taskId, connectorName);
    }

    /**
     * Check all connectors and restart any failed tasks.
     */
    public void checkAndRestartFailedTasks() {
        List<String> connectors = listConnectors();
        if (connectors.isEmpty()) {
            log.debug("No connectors found");
            return;
        }

        for (String connector : connectors) {
            checkConnectorAndRestartFailedTasks(connector);
        }
    }

    /**
     * Check a specific connector and restart failed tasks.
     */
    public void checkConnectorAndRestartFailedTasks(String connectorName) {
        try {
            ConnectorStatus status = getConnectorStatus(connectorName);
            if (status == null || status.getTasks() == null) {
                log.warn("Could not get status for connector {}", connectorName);
                return;
            }

            for (ConnectorStatus.TaskStatus task : status.getTasks()) {
                if ("FAILED".equals(task.getState())) {
                    log.warn("Connector {} task {} is FAILED. Trace: {}",
                            connectorName, task.getId(),
                            task.getTrace() != null ? task.getTrace().split("\n")[0] : "N/A");

                    restartTask(connectorName, task.getId());
                }
            }
        } catch (Exception e) {
            log.error("Failed to check connector {}", connectorName, e);
        }
    }

}
