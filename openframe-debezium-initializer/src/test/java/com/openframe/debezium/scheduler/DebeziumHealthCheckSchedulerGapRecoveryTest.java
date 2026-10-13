package com.openframe.debezium.scheduler;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.service.IntegratedToolService;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.debezium.naming.VersionedConnectorNameStrategy;
import com.openframe.debezium.recovery.RecreationTracker;
import com.openframe.debezium.recovery.gap.BackfillDispatcher;
import com.openframe.debezium.recovery.gap.CheckpointRecorder;
import com.openframe.debezium.recovery.gap.ConnectorRecreator;
import com.openframe.debezium.service.ConnectorRecoveryManager;
import com.openframe.debezium.service.DebeziumService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DebeziumHealthCheckSchedulerGapRecoveryTest {

    private static final String MESH = "shared-meshcentral-mongo-connector";
    private static final String FLEET = "shared-fleet-mysql-connector";
    private static final Map<String, Object> MESH_SPEC = Map.of("name", MESH, "config", Map.of("connector.class", "mongo"));
    private static final Map<String, Object> FLEET_SPEC = Map.of("name", FLEET, "config", Map.of("connector.class", "mysql"));

    @Mock private DebeziumService debeziumService;
    @Mock private ConnectorRecoveryManager recoveryManager;
    @Mock private IntegratedToolService integratedToolService;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private ConnectorRecreator connectorRecreator;
    @Mock private CheckpointRecorder checkpointRecorder;
    @Mock private BackfillDispatcher backfillDispatcher;
    @Mock private RecreationTracker recreationTracker;

    private DebeziumHealthCheckScheduler scheduler;
    private List<IntegratedTool> tools;

    @BeforeEach
    void setUp() {
        scheduler = new DebeziumHealthCheckScheduler(debeziumService, recoveryManager, integratedToolService,
                tenantIdProvider, new VersionedConnectorNameStrategy(), connectorRecreator, checkpointRecorder, backfillDispatcher,
                recreationTracker);
        IntegratedTool mesh = IntegratedTool.builder().id("mesh").enabled(true).debeziumConnectors(new Object[]{MESH_SPEC}).build();
        IntegratedTool fleet = IntegratedTool.builder().id("fleet").enabled(true).debeziumConnectors(new Object[]{FLEET_SPEC}).build();
        tools = List.of(mesh, fleet);
    }

    @Test
    void checkAndRestartFailedTasks_missingWithFreshCheckpoint_restoredOthersCreatedAsNew() {
        // setup
        stubMissingBoth();
        when(connectorRecreator.hasFreshCheckpoint(MESH)).thenReturn(true);
        when(connectorRecreator.hasFreshCheckpoint(FLEET)).thenReturn(false);
        when(recreationTracker.canRecreate(MESH)).thenReturn(true);

        // execution
        scheduler.checkAndRestartFailedTasks();

        // verifications
        verify(recreationTracker).record(MESH);
        verify(connectorRecreator).restoreFromCheckpoint(MESH, MESH + "_v1", MESH_SPEC);
        verify(connectorRecreator, never()).restoreFromCheckpoint(FLEET, FLEET + "_v1", FLEET_SPEC);
        verify(debeziumService).reconcileMissingConnectors(tools, Set.of(FLEET));
    }

    @Test
    void checkAndRestartFailedTasks_restoreFails_tickContinues() {
        // setup
        stubMissingBoth();
        when(connectorRecreator.hasFreshCheckpoint(MESH)).thenReturn(true);
        when(connectorRecreator.hasFreshCheckpoint(FLEET)).thenReturn(true);
        when(recreationTracker.canRecreate(MESH)).thenReturn(true);
        when(recreationTracker.canRecreate(FLEET)).thenReturn(true);
        doThrow(new IllegalStateException("connect down")).when(connectorRecreator).restoreFromCheckpoint(MESH, MESH + "_v1", MESH_SPEC);

        // execution
        scheduler.checkAndRestartFailedTasks();

        // verifications
        verify(connectorRecreator).restoreFromCheckpoint(FLEET, FLEET + "_v1", FLEET_SPEC);
        verify(recoveryManager).checkAndRecoverAll();
        verify(checkpointRecorder).recordAll();
    }

    @Test
    void checkAndRestartFailedTasks_restoreRateLimited_deferredWithoutFreshCreate() {
        // setup
        stubMissingBoth();
        when(connectorRecreator.hasFreshCheckpoint(MESH)).thenReturn(true);
        when(connectorRecreator.hasFreshCheckpoint(FLEET)).thenReturn(false);
        when(recreationTracker.canRecreate(MESH)).thenReturn(false);

        // execution
        scheduler.checkAndRestartFailedTasks();

        // verifications
        verify(recreationTracker, never()).record(MESH);
        verify(connectorRecreator, never()).restoreFromCheckpoint(MESH, MESH + "_v1", MESH_SPEC);
        verify(debeziumService).reconcileMissingConnectors(tools, Set.of(FLEET));
    }

    @Test
    void checkAndRestartFailedTasks_trackerRecordFails_restoreSkippedTickContinues() {
        // setup
        stubMissingBoth();
        when(connectorRecreator.hasFreshCheckpoint(MESH)).thenReturn(true);
        when(connectorRecreator.hasFreshCheckpoint(FLEET)).thenReturn(false);
        when(recreationTracker.canRecreate(MESH)).thenReturn(true);
        doThrow(new IllegalStateException("mongo down")).when(recreationTracker).record(MESH);

        // execution
        scheduler.checkAndRestartFailedTasks();

        // verifications
        verify(connectorRecreator, never()).restoreFromCheckpoint(MESH, MESH + "_v1", MESH_SPEC);
        verify(recoveryManager).checkAndRecoverAll();
    }

    @Test
    void checkAndRestartFailedTasks_checkpointRecordingFails_backfillsStillDispatched() {
        // setup
        when(tenantIdProvider.isTenantRegistered()).thenReturn(false);
        doThrow(new IllegalStateException("mongo down")).when(checkpointRecorder).recordAll();

        // execution
        scheduler.checkAndRestartFailedTasks();

        // verifications
        verify(backfillDispatcher).dispatchPending();
    }

    @Test
    void checkAndRestartFailedTasks_gapRecoveryDisabled_allMissingCreatedAsNew() {
        // setup
        DebeziumHealthCheckScheduler withoutGapRecovery = new DebeziumHealthCheckScheduler(debeziumService, recoveryManager,
                integratedToolService, tenantIdProvider, new VersionedConnectorNameStrategy(), null, null, null, null);
        stubMissingBoth();

        // execution
        withoutGapRecovery.checkAndRestartFailedTasks();

        // verifications
        verify(debeziumService).reconcileMissingConnectors(tools, Set.of(MESH, FLEET));
    }

    private void stubMissingBoth() {
        when(tenantIdProvider.isTenantRegistered()).thenReturn(true);
        when(integratedToolService.getAllTools()).thenReturn(tools);
        when(debeziumService.extractExpectedConnectorNames(tools)).thenReturn(Set.of(MESH, FLEET));
        when(debeziumService.listConnectors()).thenReturn(List.of("some-other-connector_v1"));
    }
}
