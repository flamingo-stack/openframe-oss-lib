package com.openframe.data.nats.delivery.route;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.delivery.ClientUninstallDeliverySeed;
import com.openframe.data.nats.delivery.ClientUpdateDeliverySeed;
import com.openframe.data.nats.delivery.ScriptScheduleDeliverySeed;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.data.service.machine.AgentVersionService;
import com.openframe.delivery.metrics.DeliveryMetrics;
import com.openframe.delivery.spec.DeliveryAudience;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// the routes as they stand: the legacy one carries the script batch alone, the engine every type with a spec
@ExtendWith(MockitoExtension.class)
class DeliveryRouterTest {

    private static final String MACHINE_ID = "mach-42";

    @Mock private ObjectProvider<DeliveryRoute> routes;
    @Mock private AgentVersionService agentVersions;
    @Mock private DeliveryMetrics metrics;
    @Mock private DeliveryRoute legacy;
    @Mock private DeliveryRoute engine;

    private DeliveryRouter router;
    private ScriptScheduleDeliverySeed scriptBatch;
    private ClientUninstallDeliverySeed uninstall;
    private ClientUpdateDeliverySeed everyMachine;

    @BeforeEach
    void setUp() {
        lenient().when(legacy.getGeneration()).thenReturn(0);
        lenient().when(legacy.getTypes()).thenReturn(EnumSet.of(DeliveryType.SCRIPT_SCHEDULE));
        lenient().when(engine.getGeneration()).thenReturn(1);
        lenient().when(engine.getTypes()).thenReturn(EnumSet.of(DeliveryType.SCRIPT_SCHEDULE, DeliveryType.CLIENT_UNINSTALL,
                DeliveryType.CLIENT_UPDATE, DeliveryType.CLIENT_FEATURE_FLAGS));
        when(routes.orderedStream()).thenReturn(Stream.of(legacy, engine));
        router = new DeliveryRouter(routes, agentVersions, metrics);
        ScriptScheduleExecutionMessage batch = ScriptScheduleExecutionMessage.builder().executionId("exec-1").build();
        scriptBatch = ScriptScheduleDeliverySeed.skippingOffline(MACHINE_ID, batch);
        uninstall = new ClientUninstallDeliverySeed(MACHINE_ID);
        everyMachine = ClientUpdateDeliverySeed.forEveryMachine(OpenFrameClientConfiguration.builder().version("1.6.0").build());
    }

    @Test
    void dispatch_engineReachesTheMachine_newestGenerationWins() {
        // setup
        when(agentVersions.find(MACHINE_ID)).thenReturn(Optional.of("1.6.0"));
        when(engine.canReach(DeliveryType.SCRIPT_SCHEDULE, "1.6.0")).thenReturn(true);

        // execution
        boolean carried = router.dispatch(scriptBatch);

        // verifications
        assertThat(carried).isTrue();
        verify(engine).send(scriptBatch);
        verify(legacy, never()).send(any());
    }

    @Test
    void dispatch_scriptBatchForAnAgentBelowTheEngine_legacyCarriesIt() {
        // setup
        when(agentVersions.find(MACHINE_ID)).thenReturn(Optional.of("1.5.0"));
        when(engine.canReach(DeliveryType.SCRIPT_SCHEDULE, "1.5.0")).thenReturn(false);
        when(legacy.canReach(DeliveryType.SCRIPT_SCHEDULE, "1.5.0")).thenReturn(true);

        // execution
        boolean carried = router.dispatch(scriptBatch);

        // verifications
        assertThat(carried).isTrue();
        verify(legacy).send(scriptBatch);
        verify(engine, never()).send(any());
    }

    @Test
    void dispatch_versionUnknown_routesAskedWithAnEmptyVersion() {
        // setup
        when(agentVersions.find(MACHINE_ID)).thenReturn(Optional.empty());
        when(engine.canReach(DeliveryType.SCRIPT_SCHEDULE, "")).thenReturn(false);
        when(legacy.canReach(DeliveryType.SCRIPT_SCHEDULE, "")).thenReturn(true);

        // execution
        boolean carried = router.dispatch(scriptBatch);

        // verifications
        assertThat(carried).isTrue();
        verify(legacy).send(scriptBatch);
    }

    @Test
    void dispatch_engineOnlyTypeForAnAgentTheEngineDoesNotAdmit_nothingSentAndReportedSo() {
        // setup
        when(agentVersions.find(MACHINE_ID)).thenReturn(Optional.of("1.5.0"));
        when(engine.canReach(DeliveryType.CLIENT_UNINSTALL, "1.5.0")).thenReturn(false);

        // execution
        boolean carried = router.dispatch(uninstall);

        // verifications
        assertThat(carried).isFalse();
        verify(engine, never()).send(any());
        verify(legacy, never()).canReach(any(), any());
        verify(legacy, never()).send(any());
        verify(metrics).recordUnreachable(DeliveryType.CLIENT_UNINSTALL, DeliveryAudience.MACHINE);
    }

    @Test
    void dispatch_noRouteReachesTheMachine_nothingSentAndReportedSo() {
        // setup
        when(agentVersions.find(MACHINE_ID)).thenReturn(Optional.of("1.5.0"));
        when(engine.canReach(any(), anyString())).thenReturn(false);
        when(legacy.canReach(any(), anyString())).thenReturn(false);

        // execution
        boolean carried = router.dispatch(scriptBatch);

        // verifications
        assertThat(carried).isFalse();
        verify(engine, never()).send(any());
        verify(legacy, never()).send(any());
        verify(metrics).recordUnreachable(DeliveryType.SCRIPT_SCHEDULE, DeliveryAudience.MACHINE);
    }

    @Test
    void dispatch_everyMachine_theEngineAloneCarriesIt() {
        // setup
        when(engine.canReachEveryMachine(DeliveryType.CLIENT_UPDATE)).thenReturn(true);

        // execution
        boolean carried = router.dispatch(everyMachine);

        // verifications
        assertThat(carried).isTrue();
        verify(engine).sendToEveryMachine(everyMachine);
        verify(legacy, never()).canReachEveryMachine(any());
        verify(legacy, never()).sendToEveryMachine(any());
        verify(agentVersions, never()).find(any());
    }

    @Test
    void dispatch_everyMachineEngineClosed_nothingSentAndReportedSo() {
        // setup
        when(engine.canReachEveryMachine(DeliveryType.CLIENT_UPDATE)).thenReturn(false);

        // execution
        boolean carried = router.dispatch(everyMachine);

        // verifications
        assertThat(carried).isFalse();
        verify(engine, never()).sendToEveryMachine(any());
        verify(legacy, never()).sendToEveryMachine(any());
        verify(metrics).recordUnreachable(DeliveryType.CLIENT_UPDATE, DeliveryAudience.EVERY_MACHINE);
    }

    @Test
    void boot_twoRoutesOfOneGenerationOnOneType_refused() {
        // setup
        DeliveryRoute twin = mock(DeliveryRoute.class);
        when(twin.getGeneration()).thenReturn(1);
        when(twin.getTypes()).thenReturn(EnumSet.of(DeliveryType.CLIENT_UNINSTALL));
        when(routes.orderedStream()).thenReturn(Stream.of(legacy, engine, twin));

        // execution + verifications
        assertThatThrownBy(() -> new DeliveryRouter(routes, agentVersions, metrics))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("generation 1")
                .hasMessageContaining("CLIENT_UNINSTALL");
    }

    @Test
    void dispatch_typeWithoutAnyRoute_nothingSent() {
        // setup
        when(routes.orderedStream()).thenReturn(Stream.empty());
        DeliveryRouter emptyRouter = new DeliveryRouter(routes, agentVersions, metrics);
        when(agentVersions.find(MACHINE_ID)).thenReturn(Optional.of("1.6.0"));

        // execution
        boolean carried = emptyRouter.dispatch(uninstall);

        // verifications
        assertThat(carried).isFalse();
    }

    @Test
    void holdsForOfflineMachine_theReachingRouteAnswers() {
        // setup
        when(agentVersions.find(MACHINE_ID)).thenReturn(Optional.of("1.6.0"));
        when(engine.canReach(DeliveryType.SCRIPT_SCHEDULE, "1.6.0")).thenReturn(true);
        when(engine.holdsForOfflineMachine(DeliveryType.SCRIPT_SCHEDULE)).thenReturn(true);

        // execution
        boolean held = router.holdsForOfflineMachine(DeliveryType.SCRIPT_SCHEDULE, MACHINE_ID);

        // verifications
        assertThat(held).isTrue();
        verify(legacy, never()).holdsForOfflineMachine(any());
    }

    @Test
    void holdsForOfflineMachine_scriptBatchBelowTheEngine_legacyAnswers() {
        // setup
        when(agentVersions.find(MACHINE_ID)).thenReturn(Optional.of("1.5.0"));
        when(engine.canReach(DeliveryType.SCRIPT_SCHEDULE, "1.5.0")).thenReturn(false);
        when(legacy.canReach(DeliveryType.SCRIPT_SCHEDULE, "1.5.0")).thenReturn(true);
        when(legacy.holdsForOfflineMachine(DeliveryType.SCRIPT_SCHEDULE)).thenReturn(false);

        // execution
        boolean held = router.holdsForOfflineMachine(DeliveryType.SCRIPT_SCHEDULE, MACHINE_ID);

        // verifications
        assertThat(held).isFalse();
        verify(engine, never()).holdsForOfflineMachine(any());
    }

    @Test
    void holdsForOfflineMachine_noRouteReachesTheMachine_false() {
        // setup
        when(agentVersions.find(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        boolean held = router.holdsForOfflineMachine(DeliveryType.CLIENT_UNINSTALL, MACHINE_ID);

        // verifications
        assertThat(held).isFalse();
    }

    @Test
    void reachable_theMachinesWhoseVersionARouteAdmits_oneVersionLookupForAll() {
        // setup
        List<String> asked = List.of("new", "old", "unknown");
        when(agentVersions.findAll(asked)).thenReturn(Map.of("new", "1.6.0", "old", "1.5.0"));
        when(engine.canReach(DeliveryType.CLIENT_FEATURE_FLAGS, "1.6.0")).thenReturn(true);
        when(engine.canReach(DeliveryType.CLIENT_FEATURE_FLAGS, "1.5.0")).thenReturn(false);
        when(engine.canReach(DeliveryType.CLIENT_FEATURE_FLAGS, "")).thenReturn(false);

        // execution
        Set<String> reachable = router.reachable(DeliveryType.CLIENT_FEATURE_FLAGS, asked);

        // verifications
        assertThat(reachable).containsExactly("new");
        verify(agentVersions, never()).find(any());
        verify(metrics, never()).recordUnreachable(any(), any());   // a probe, not a dispatch
    }

    @Test
    void reaches_theRouteAnswersForThatMachinesVersion() {
        // setup
        when(agentVersions.find(MACHINE_ID)).thenReturn(Optional.of("1.6.0"));
        when(engine.canReach(DeliveryType.CLIENT_FEATURE_FLAGS, "1.6.0")).thenReturn(true);

        // execution
        boolean reaches = router.reaches(DeliveryType.CLIENT_FEATURE_FLAGS, MACHINE_ID);

        // verifications
        assertThat(reaches).isTrue();
        verify(metrics, never()).recordUnreachable(any(), any());
    }

    @Test
    void reaches_versionUnknown_askedWithAnEmptyVersion() {
        // setup
        when(agentVersions.find(MACHINE_ID)).thenReturn(Optional.empty());
        when(engine.canReach(DeliveryType.CLIENT_FEATURE_FLAGS, "")).thenReturn(false);

        // execution
        boolean reaches = router.reaches(DeliveryType.CLIENT_FEATURE_FLAGS, MACHINE_ID);

        // verifications
        assertThat(reaches).isFalse();
    }
}
