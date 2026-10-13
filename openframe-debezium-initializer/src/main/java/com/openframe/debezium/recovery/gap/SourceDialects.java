package com.openframe.debezium.recovery.gap;

import com.openframe.debezium.util.ConnectorSpecs;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
@ConditionalOnProperty(name = "openframe.debezium.recovery.gap.enabled", havingValue = "true")
@RequiredArgsConstructor
public class SourceDialects {

    private final List<SourceDialect> dialects;

    public boolean supports(Map<String, Object> config) {
        String connectorClass = ConnectorSpecs.stringOf(config, ConnectorSpecs.KEY_CONNECTOR_CLASS);
        return dialects.stream().anyMatch(dialect -> dialect.connectorClass().equals(connectorClass));
    }

    public SourceDialect dialectFor(Map<String, Object> config) {
        String connectorClass = ConnectorSpecs.stringOf(config, ConnectorSpecs.KEY_CONNECTOR_CLASS);
        return dialects.stream()
                .filter(dialect -> dialect.connectorClass().equals(connectorClass))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("No source dialect for connector class: " + connectorClass));
    }

    public boolean isHistoryLost(List<String> failureTraces) {
        return failureTraces.stream().anyMatch(this::containsHistoryLostMarker);
    }

    private boolean containsHistoryLostMarker(String trace) {
        return dialects.stream()
                .flatMap(dialect -> dialect.historyLostMarkers().stream())
                .anyMatch(trace::contains);
    }
}
