package com.openframe.debezium.service;

import com.openframe.data.document.connector.ConnectorAlert;
import com.openframe.data.document.connector.ConnectorAlertType;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.repository.connector.ConnectorAlertRepository;
import com.openframe.data.service.IntegratedToolService;
import com.openframe.debezium.dto.ConnectorOffsets;
import com.openframe.debezium.dto.ConnectorStatus;
import com.openframe.debezium.naming.VersionedConnectorNameStrategy;
import com.openframe.debezium.recovery.RecreationTracker;
import com.openframe.debezium.recovery.gap.ConnectorRecreator;
import com.openframe.debezium.recovery.gap.RecreationRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConnectorRecoveryManagerGapRecoveryTest {

    private static final String BASE = "shared-meshcentral-mongo-connector";
    private static final String FAILED = BASE + "_v2";
    private static final String NEXT = BASE + "_v3";
    private static final String HISTORY_LOST_TRACE = "com.mongodb.MongoCommandException: error 286 (ChangeStreamHistoryLost)";
    private static final Map<String, Object> CONFIG = Map.of("connector.class", "io.debezium.connector.mongodb.MongoDbConnector");
    private static final Map<String, Object> SPEC = Map.of("name", BASE, "config", CONFIG);
    private static final String CONFIG_ERROR_TRACE = "org.apache.kafka.common.config.ConfigException: bad value";
    private static final Set<ConnectorAlertType> RECOVERY_ALERT_TYPES =
            Set.of(ConnectorAlertType.MAX_RETRIES_EXCEEDED, ConnectorAlertType.NON_RECOVERABLE_ERROR);

    @Mock private DebeziumService debeziumService;
    @Mock private ConnectorAlertRepository alertRepository;
    @Mock private RecreationTracker recreationTracker;
    @Mock private IntegratedToolService integratedToolService;
    @Mock private ConnectorRecreator connectorRecreator;

    @Captor private ArgumentCaptor<RecreationRequest> requestCaptor;

    private ConnectorRecoveryManager manager;
    private ConnectorStatus failedStatus;
    private ConnectorStatus.TaskStatus failedTask;
    private ConnectorOffsets offsets;

    @BeforeEach
    void setUp() {
        manager = new ConnectorRecoveryManager(debeziumService, alertRepository, new VersionedConnectorNameStrategy(),
                recreationTracker, integratedToolService, connectorRecreator);
        ConnectorStatus.Connector connector = new ConnectorStatus.Connector();
        connector.setState("RUNNING");
        failedTask = new ConnectorStatus.TaskStatus();
        failedTask.setState("FAILED");
        failedTask.setTrace(HISTORY_LOST_TRACE);
        failedStatus = new ConnectorStatus();
        failedStatus.setConnector(connector);
        failedStatus.setTasks(List.of(failedTask));
        offsets = new ConnectorOffsets(List.of(Map.of("offset", Map.of("sec", 1L))));
    }

    @Test
    void checkAndRecover_historyLost_recreatedImmediatelyAsHistoryLost() {
        // setup
        stubHistoryLostRecreation();
        when(recreationTracker.canRecreate(BASE)).thenReturn(true);

        // execution
        manager.checkAndRecover(FAILED);

        // verifications
        verify(debeziumService, never()).restartConnectorWithFailedTasks(FAILED);
        verify(connectorRecreator).recreate(requestCaptor.capture());
        assertThat(requestCaptor.getValue())
                .extracting(RecreationRequest::getNewName, RecreationRequest::isDiscardOffsets, RecreationRequest::getLastKnownOffsets)
                .containsExactly(NEXT, true, offsets);
        verify(debeziumService).deleteConnector(FAILED);
        verify(alertRepository, never()).save(any(ConnectorAlert.class));
    }

    @Test
    void checkAndRecover_historyLostAndRecreateRejected_alertRaised() {
        // setup
        stubHistoryLostRecreation();
        when(recreationTracker.canRecreate(BASE)).thenReturn(true);
        doThrow(new IllegalStateException("connect rejected")).when(connectorRecreator).recreate(any(RecreationRequest.class));

        // execution
        manager.checkAndRecover(FAILED);

        // verifications
        verify(alertRepository).save(any(ConnectorAlert.class));
        verify(debeziumService, never()).deleteConnector(FAILED);
    }

    @Test
    void checkAndRecover_historyLostButSpecHasNoConfig_alertRaisedWithoutRecreate() {
        // setup
        when(debeziumService.getConnectorStatus(FAILED)).thenReturn(failedStatus);
        when(connectorRecreator.isHistoryLost(failedStatus)).thenReturn(true);
        when(recreationTracker.canRecreate(BASE)).thenReturn(true);
        IntegratedTool withoutConfig = IntegratedTool.builder().id("t").enabled(true)
                .debeziumConnectors(new Object[]{Map.of("name", BASE)}).build();
        when(integratedToolService.getAllTools()).thenReturn(List.of(withoutConfig));

        // execution
        manager.checkAndRecover(FAILED);

        // verifications
        verify(connectorRecreator, never()).recreate(any(RecreationRequest.class));
        verify(alertRepository).save(any(ConnectorAlert.class));
    }

    @Test
    void checkAndRecover_nonRecoverableWithoutGapRecovery_createdDirectlyFromSpecConfig() {
        // setup
        ConnectorRecoveryManager withoutGapRecovery = new ConnectorRecoveryManager(debeziumService, alertRepository,
                new VersionedConnectorNameStrategy(), recreationTracker, integratedToolService, null);
        failedTask.setTrace("org.apache.kafka.common.config.ConfigException: bad value");
        when(debeziumService.getConnectorStatus(FAILED)).thenReturn(failedStatus);
        when(recreationTracker.canRecreate(BASE)).thenReturn(true);
        when(integratedToolService.getAllTools()).thenReturn(List.of(tool()));
        when(debeziumService.listConnectors()).thenReturn(List.of(FAILED));

        // execution
        withoutGapRecovery.checkAndRecover(FAILED);

        // verifications
        verify(debeziumService).createConnector(NEXT, CONFIG);
    }

    @Test
    void checkAndRecover_historyLostButRecreationLimitReached_alertRaised() {
        // setup
        when(debeziumService.getConnectorStatus(FAILED)).thenReturn(failedStatus);
        when(connectorRecreator.isHistoryLost(failedStatus)).thenReturn(true);
        when(recreationTracker.canRecreate(BASE)).thenReturn(false);

        // execution
        manager.checkAndRecover(FAILED);

        // verifications
        verify(connectorRecreator, never()).recreate(any(RecreationRequest.class));
        verify(alertRepository).save(any(ConnectorAlert.class));
    }

    @Test
    void checkAndRecover_ordinaryFailure_restartedNotRecreated() {
        // setup
        when(debeziumService.getConnectorStatus(FAILED)).thenReturn(failedStatus);
        when(connectorRecreator.isHistoryLost(failedStatus)).thenReturn(false);

        // execution
        manager.checkAndRecover(FAILED);

        // verifications
        verify(debeziumService).restartConnectorWithFailedTasks(FAILED);
        verify(connectorRecreator, never()).recreate(any(RecreationRequest.class));
    }

    @Test
    void checkAndRecover_historyLostWithoutGapRecovery_restartedAsBefore() {
        // setup
        ConnectorRecoveryManager withoutGapRecovery = new ConnectorRecoveryManager(debeziumService, alertRepository,
                new VersionedConnectorNameStrategy(), recreationTracker, integratedToolService, null);
        when(debeziumService.getConnectorStatus(FAILED)).thenReturn(failedStatus);

        // execution
        withoutGapRecovery.checkAndRecover(FAILED);

        // verifications
        verify(debeziumService).restartConnectorWithFailedTasks(FAILED);
    }

    @Test
    void checkAndRecover_nonRecoverableFirstInWindow_offsetsHandedOver() {
        // setup
        stubNonRecoverableRecreation();
        when(recreationTracker.hasRecentRecreation(BASE)).thenReturn(false);

        // execution
        manager.checkAndRecover(FAILED);

        // verifications
        verify(connectorRecreator).recreate(requestCaptor.capture());
        assertThat(requestCaptor.getValue())
                .extracting(RecreationRequest::getNewName, RecreationRequest::isDiscardOffsets)
                .containsExactly(NEXT, false);
    }

    @Test
    void checkAndRecover_nonRecoverableRecreatedWithinWindow_offsetsDiscarded() {
        // setup
        stubNonRecoverableRecreation();
        when(recreationTracker.hasRecentRecreation(BASE)).thenReturn(true);

        // execution
        manager.checkAndRecover(FAILED);

        // verifications
        verify(connectorRecreator).recreate(requestCaptor.capture());
        assertThat(requestCaptor.getValue())
                .extracting(RecreationRequest::getNewName, RecreationRequest::isDiscardOffsets, RecreationRequest::getLastKnownOffsets)
                .containsExactly(NEXT, true, offsets);
    }

    @Test
    void checkAndRecover_healthyWithOpenGapAlert_onlyRecoveryAlertsResolved() {
        // setup
        ConnectorStatus healthy = new ConnectorStatus();
        ConnectorStatus.Connector connector = new ConnectorStatus.Connector();
        connector.setState("RUNNING");
        healthy.setConnector(connector);
        healthy.setTasks(List.of());
        when(debeziumService.getConnectorStatus(FAILED)).thenReturn(healthy);
        when(alertRepository.findByConnectorNameAndErrorTypeInAndResolvedFalse(FAILED, RECOVERY_ALERT_TYPES))
                .thenReturn(Optional.empty());

        // execution
        manager.checkAndRecover(FAILED);

        // verifications
        verify(alertRepository, never()).save(any(ConnectorAlert.class));
    }

    private void stubNonRecoverableRecreation() {
        failedTask.setTrace(CONFIG_ERROR_TRACE);
        when(debeziumService.getConnectorStatus(FAILED)).thenReturn(failedStatus);
        when(connectorRecreator.isHistoryLost(failedStatus)).thenReturn(false);
        when(recreationTracker.canRecreate(BASE)).thenReturn(true);
        when(integratedToolService.getAllTools()).thenReturn(List.of(tool()));
        when(debeziumService.listConnectors()).thenReturn(List.of(FAILED));
        when(connectorRecreator.lastKnownOffsets(BASE, FAILED)).thenReturn(offsets);
    }

    private void stubHistoryLostRecreation() {
        when(debeziumService.getConnectorStatus(FAILED)).thenReturn(failedStatus);
        when(connectorRecreator.isHistoryLost(failedStatus)).thenReturn(true);
        when(integratedToolService.getAllTools()).thenReturn(List.of(tool()));
        when(debeziumService.listConnectors()).thenReturn(List.of(FAILED));
        when(connectorRecreator.lastKnownOffsets(BASE, FAILED)).thenReturn(offsets);
    }

    private static IntegratedTool tool() {
        return IntegratedTool.builder()
                .id("meshcentral-mongodb")
                .enabled(true)
                .debeziumConnectors(new Object[]{SPEC})
                .build();
    }
}
