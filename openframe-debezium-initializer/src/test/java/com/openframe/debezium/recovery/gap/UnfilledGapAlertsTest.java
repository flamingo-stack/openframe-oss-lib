package com.openframe.debezium.recovery.gap;

import com.openframe.data.document.connector.ConnectorAlert;
import com.openframe.data.document.connector.ConnectorAlertType;
import com.openframe.data.repository.connector.ConnectorAlertRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UnfilledGapAlertsTest {

    private static final String CONNECTOR = "shared-fleet-mysql-connector_v3";
    private static final Instant GAP_FROM = Instant.parse("2026-10-13T08:55:00Z");
    private static final String REASON = "No Kafka signal channel in the connector config";

    @Mock private ConnectorAlertRepository alertRepository;

    @Captor private ArgumentCaptor<ConnectorAlert> alertCaptor;

    @InjectMocks private UnfilledGapAlerts gapAlerts;

    @Test
    void raise_noOpenGapAlert_unresolvedGapAlertSaved() {
        // setup
        when(alertRepository.existsByConnectorNameAndErrorTypeAndResolvedFalse(CONNECTOR, ConnectorAlertType.GAP_UNFILLED))
                .thenReturn(false);

        // execution
        gapAlerts.raise(CONNECTOR, GAP_FROM, REASON);

        // verifications
        verify(alertRepository).save(alertCaptor.capture());
        assertThat(alertCaptor.getValue())
                .extracting(ConnectorAlert::getConnectorName, ConnectorAlert::getErrorType, ConnectorAlert::isResolved)
                .containsExactly(CONNECTOR, ConnectorAlertType.GAP_UNFILLED, false);
        assertThat(alertCaptor.getValue().getErrorMessage())
                .isEqualTo(REASON + "; events since 2026-10-13T08:55:00Z may be missing downstream");
        assertThat(alertCaptor.getValue().getCreatedAt()).isNotNull();
    }

    @Test
    void raise_gapAlertAlreadyOpen_notDuplicated() {
        // setup
        when(alertRepository.existsByConnectorNameAndErrorTypeAndResolvedFalse(CONNECTOR, ConnectorAlertType.GAP_UNFILLED))
                .thenReturn(true);

        // execution
        gapAlerts.raise(CONNECTOR, GAP_FROM, REASON);

        // verifications
        verify(alertRepository, never()).save(any(ConnectorAlert.class));
    }

    @Test
    void raise_repositoryFails_swallowed() {
        // setup
        when(alertRepository.existsByConnectorNameAndErrorTypeAndResolvedFalse(CONNECTOR, ConnectorAlertType.GAP_UNFILLED))
                .thenReturn(false);
        doThrow(new IllegalStateException("mongo down")).when(alertRepository).save(any(ConnectorAlert.class));

        // execution
        gapAlerts.raise(CONNECTOR, GAP_FROM, REASON);

        // verifications
        verify(alertRepository).save(any(ConnectorAlert.class));
    }
}
