package com.openframe.debezium.recovery.gap;

import com.openframe.data.document.connector.ConnectorBackfill;
import com.openframe.data.document.connector.ConnectorBackfillStatus;
import com.openframe.data.repository.connector.ConnectorBackfillRepository;
import com.openframe.debezium.dto.ConnectorStatus;
import com.openframe.debezium.naming.ConnectorNameStrategy;
import com.openframe.debezium.naming.VersionedConnectorNameStrategy;
import com.openframe.debezium.service.DebeziumService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BackfillDispatcherTest {

    private static final String BASE = "shared-fleet-mysql-connector";
    private static final String CURRENT = BASE + "_v5";
    private static final Instant GAP_FROM = Instant.parse("2026-10-13T08:55:00Z");
    private static final Duration EXPIRY = Duration.ofHours(2);
    private static final Map<String, Object> CONFIG = Map.of("connector.class", "io.debezium.connector.mysql.MySqlConnector");
    private static final Map<String, Object> BACKFILL = Map.of("fleet.activity_past", "created_at >= {from}");
    private static final Map<String, Object> SPEC = Map.of("name", BASE, "config", CONFIG, "backfill", BACKFILL);
    private static final List<SnapshotCondition> CONDITIONS =
            List.of(new SnapshotCondition("fleet.activity_past", "created_at >= '2026-10-13 08:55:00'"));

    @Mock private ConnectorBackfillRepository backfillRepository;
    @Mock private DebeziumService debeziumService;
    @Mock private ToolConnectorSpecs toolConnectorSpecs;
    @Mock private SourceDialects sourceDialects;
    @Mock private SourceDialect sourceDialect;
    @Mock private SnapshotSignalPublisher signalPublisher;
    @Mock private UnfilledGapAlerts gapAlerts;

    @Captor private ArgumentCaptor<ConnectorBackfill> backfillCaptor;

    private BackfillDispatcher dispatcher;
    private ConnectorBackfill backfill;

    @BeforeEach
    void setUp() {
        GapRecoveryProperties properties = new GapRecoveryProperties();
        properties.setBackfillExpiry(EXPIRY);
        ConnectorNameStrategy nameStrategy = new VersionedConnectorNameStrategy();
        dispatcher = new BackfillDispatcher(backfillRepository, debeziumService, nameStrategy,
                toolConnectorSpecs, sourceDialects, signalPublisher, properties, gapAlerts);
        backfill = ConnectorBackfill.builder()
                .baseName(BASE)
                .connectorName(BASE + "_v4")
                .gapFrom(GAP_FROM)
                .status(ConnectorBackfillStatus.PENDING)
                .createdAt(Instant.now())
                .build();
    }

    @Test
    void dispatchPending_currentVersionRunning_signalSentAndMarkedSent() {
        // setup
        stubPendingAndConnectors();
        stubRunningWithSpec();
        when(signalPublisher.hasSignalChannel(CONFIG)).thenReturn(true);
        when(sourceDialects.dialectFor(CONFIG)).thenReturn(sourceDialect);
        when(sourceDialect.gapConditions(CONFIG, Map.of("fleet.activity_past", "created_at >= {from}"), GAP_FROM))
                .thenReturn(CONDITIONS);

        // execution
        dispatcher.dispatchPending();

        // verifications
        verify(signalPublisher).publishIncrementalSnapshot(CONFIG, CONDITIONS);
        verify(backfillRepository).save(backfillCaptor.capture());
        assertThat(backfillCaptor.getValue())
                .extracting(ConnectorBackfill::getStatus, ConnectorBackfill::getConnectorName)
                .containsExactly(ConnectorBackfillStatus.SENT, CURRENT);
        assertThat(backfillCaptor.getValue().getSentAt()).isNotNull();
    }

    @Test
    void dispatchPending_connectorNotRunningYet_leftPending() {
        // setup
        stubPendingAndConnectors();
        when(toolConnectorSpecs.hasSpec(BASE)).thenReturn(true);
        when(debeziumService.getConnectorStatus(CURRENT)).thenReturn(status("UNASSIGNED"));

        // execution
        dispatcher.dispatchPending();

        // verifications
        verify(signalPublisher, never()).publishIncrementalSnapshot(any(), any());
        verify(backfillRepository, never()).save(any(ConnectorBackfill.class));
    }

    @Test
    void dispatchPending_pastExpiry_markedExpiredWithoutSignal() {
        // setup
        backfill.setCreatedAt(Instant.now().minus(EXPIRY).minusSeconds(1));
        stubPendingAndConnectors();

        // execution
        dispatcher.dispatchPending();

        // verifications
        verify(signalPublisher, never()).publishIncrementalSnapshot(any(), any());
        verify(backfillRepository).save(backfillCaptor.capture());
        assertThat(backfillCaptor.getValue().getStatus()).isEqualTo(ConnectorBackfillStatus.EXPIRED);
        verify(gapAlerts).raise(BASE + "_v4", GAP_FROM, "Backfill not requested before expiry");
    }

    @Test
    void dispatchPending_noSignalChannelConfigured_markedExpired() {
        // setup
        stubPendingAndConnectors();
        stubRunningWithSpec();
        when(signalPublisher.hasSignalChannel(CONFIG)).thenReturn(false);

        // execution
        dispatcher.dispatchPending();

        // verifications
        verify(signalPublisher, never()).publishIncrementalSnapshot(any(), any());
        verify(backfillRepository).save(backfillCaptor.capture());
        assertThat(backfillCaptor.getValue().getStatus()).isEqualTo(ConnectorBackfillStatus.EXPIRED);
        verify(gapAlerts).raise(BASE + "_v4", GAP_FROM, "No Kafka signal channel in the connector config");
    }

    @Test
    void dispatchPending_publishFails_leftPendingForRetry() {
        // setup
        stubPendingAndConnectors();
        stubRunningWithSpec();
        when(signalPublisher.hasSignalChannel(CONFIG)).thenReturn(true);
        when(sourceDialects.dialectFor(CONFIG)).thenReturn(sourceDialect);
        when(sourceDialect.gapConditions(CONFIG, Map.of("fleet.activity_past", "created_at >= {from}"), GAP_FROM))
                .thenReturn(CONDITIONS);
        doThrow(new IllegalStateException("Failed to send snapshot signal"))
                .when(signalPublisher).publishIncrementalSnapshot(CONFIG, CONDITIONS);

        // execution
        dispatcher.dispatchPending();

        // verifications
        verify(backfillRepository, never()).save(any(ConnectorBackfill.class));
    }

    @Test
    void dispatchPending_baseNoLongerRegistered_leftPending() {
        // setup
        stubPendingAndConnectors();
        when(toolConnectorSpecs.hasSpec(BASE)).thenReturn(false);

        // execution
        dispatcher.dispatchPending();

        // verifications
        verify(debeziumService, never()).getConnectorStatus(CURRENT);
        verify(backfillRepository, never()).save(any(ConnectorBackfill.class));
    }

    @Test
    void dispatchPending_nothingPending_connectorsNotListed() {
        // setup
        when(backfillRepository.findByStatus(ConnectorBackfillStatus.PENDING)).thenReturn(List.of());

        // execution
        dispatcher.dispatchPending();

        // verifications
        verify(debeziumService, never()).listConnectors();
    }

    private void stubPendingAndConnectors() {
        when(backfillRepository.findByStatus(ConnectorBackfillStatus.PENDING)).thenReturn(List.of(backfill));
        when(debeziumService.listConnectors()).thenReturn(List.of(BASE + "_v4", CURRENT));
    }

    private void stubRunningWithSpec() {
        when(toolConnectorSpecs.hasSpec(BASE)).thenReturn(true);
        when(debeziumService.getConnectorStatus(CURRENT)).thenReturn(status("RUNNING"));
        when(toolConnectorSpecs.specOf(BASE)).thenReturn(SPEC);
    }

    private static ConnectorStatus status(String state) {
        ConnectorStatus.Connector connector = new ConnectorStatus.Connector();
        connector.setState(state);
        ConnectorStatus.TaskStatus task = new ConnectorStatus.TaskStatus();
        task.setState(state);
        ConnectorStatus status = new ConnectorStatus();
        status.setConnector(connector);
        status.setTasks(List.of(task));
        return status;
    }
}
