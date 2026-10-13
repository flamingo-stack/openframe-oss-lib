package com.openframe.debezium.recovery.gap;

import com.openframe.data.document.connector.ConnectorAlert;
import com.openframe.data.document.connector.ConnectorAlertType;
import com.openframe.data.repository.connector.ConnectorAlertRepository;
import com.openframe.debezium.util.DebeziumLog;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.debezium.recovery.gap.enabled", havingValue = "true")
public class UnfilledGapAlerts {

    private final ConnectorAlertRepository alertRepository;

    // Never auto-resolved: a healthy connector says nothing about the events it missed.
    public void raise(String connectorName, Instant gapFrom, String reason) {
        log.error("{} Gap left unfilled: connector='{}' gap_from={} reason={}",
                DebeziumLog.PREFIX, connectorName, gapFrom, reason);
        try {
            if (alertRepository.existsByConnectorNameAndErrorTypeAndResolvedFalse(connectorName, ConnectorAlertType.GAP_UNFILLED)) {
                return;
            }
            ConnectorAlert alert = ConnectorAlert.builder()
                    .connectorName(connectorName)
                    .errorType(ConnectorAlertType.GAP_UNFILLED)
                    .errorMessage(reason + "; events since " + gapFrom + " may be missing downstream")
                    .createdAt(Instant.now())
                    .resolved(false)
                    .build();
            alertRepository.save(alert);
        } catch (Exception e) {
            log.warn("Failed to raise unfilled-gap alert for '{}'", connectorName, e);
        }
    }
}
