package com.openframe.data.nats.delivery.route;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.delivery.ClientUninstallDeliverySeed;
import com.openframe.data.nats.delivery.ClientUpdateDeliverySeed;
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
import java.util.Optional;
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

@ExtendWith(MockitoExtension.class)
class DeliveryRouterTest {

    private static final String MACHINE_ID = "mach-42";

    @Mock private ObjectProvider<DeliveryRoute> routes;
    @Mock private AgentVersionService agentVersions;
    @Mock private DeliveryMetrics metrics;
    @Mock private DeliveryRoute legacy;
    @Mock private DeliveryRoute engine;

    private DeliveryRouter router;
    private ClientUninstallDeliverySeed uninstall;
    private ClientUpdateDeliverySeed everyMachine;

    @BeforeEach
    void setUp() {
        lenient().when(legacy.getGeneration()).thenReturn(0);
        lenient().when(legacy.getTypes()).thenReturn(EnumSet.of(DeliveryType.CLIENT_UNINSTALL, DeliveryType.CLIENT_UPDATE));
        lenient().when(engine.getGeneration()).thenReturn(1);
        lenient().when(engine.getTypes()).thenReturn(EnumSet.of(DeliveryType.CLIENT_UNINSTALL, DeliveryType.CLIENT_UPDATE, DeliveryType.CLIENT_FEATURE_FLAGS));
        when(routes.orderedStream()).thenReturn(Stream.of(legacy, engine));
        router = new DeliveryRouter(routes, agentVersions, metrics);
        uninstall = new ClientUninstallDeliverySeed(MACHINE_ID);
        everyMachine = ClientUpdateDeliverySeed.forEveryMachine(OpenFrameClientConfiguration.builder().version("1.6.0").build());
    }

    @Test
    void dispatch_engineReachesTheMachine_newestGenerationWins() {
        // setup
        when(agentVersions.find(MACHINE_ID)).thenReturn(Optional.of("1.6.0"));
        when(engine.canReach(DeliveryType.CLIENT_UNINSTALL, "1.6.0")).thenReturn(true);

        // execution
        boolean carried = router.dispatch(uninstall);

        // verifications
        assertThat(carried).isTrue();
        verify(engine).send(uninstall);
        verify(legacy, never()).send(any());
    }

    @Test
    void dispatch_agentBelowTheEngine_legacyCarriesIt() {
        // setup
        when(agentVersions.find(MACHINE_ID)).thenReturn(Optional.of("1.5.0"));
        when(engine.canReach(DeliveryType.CLIENT_UNINSTALL, "1.5.0")).thenReturn(false);
        when(legacy.canReach(DeliveryType.CLIENT_UNINSTALL, "1.5.0")).thenReturn(true);

        // execution
        boolean carried = router.dispatch(uninstall);

        // verifications
        assertThat(carried).isTrue();
        verify(legacy).send(uninstall);
        verify(engine, never()).send(any());
    }

    @Test
    void dispatch_versionUnknown_routesAskedWithAnEmptyVersion() {
        // setup
        when(agentVersions.find(MACHINE_ID)).thenReturn(Optional.empty());
        when(engine.canReach(DeliveryType.CLIENT_UNINSTALL, "")).thenReturn(false);
        when(legacy.canReach(DeliveryType.CLIENT_UNINSTALL, "")).thenReturn(true);

        // execution
        boolean carried = router.dispatch(uninstall);

        // verifications
        assertThat(carried).isTrue();
        verify(legacy).send(uninstall);
    }

    @Test
    void dispatch_noRouteReachesTheMachine_nothingSentAndReportedSo() {
        // setup
        when(agentVersions.find(MACHINE_ID)).thenReturn(Optional.of("1.5.0"));
        when(engine.canReach(any(), anyString())).thenReturn(false);
        when(legacy.canReach(any(), anyString())).thenReturn(false);

        // execution
        boolean carried = router.dispatch(uninstall);

        // verifications
        assertThat(carried).isFalse();
        verify(engine, never()).send(any());
        verify(legacy, never()).send(any());
        verify(metrics).recordUnreachable(DeliveryType.CLIENT_UNINSTALL, DeliveryAudience.MACHINE);
    }

    @Test
    void dispatch_everyMachine_eachRouteThatCarriesTheTypeSendsItsOwnBroadcast() {
        // setup
        when(engine.canReachEveryMachine(DeliveryType.CLIENT_UPDATE)).thenReturn(true);
        when(legacy.canReachEveryMachine(DeliveryType.CLIENT_UPDATE)).thenReturn(true);

        // execution
        boolean carried = router.dispatch(everyMachine);

        // verifications
        assertThat(carried).isTrue();
        verify(engine).sendToEveryMachine(everyMachine);
        verify(legacy).sendToEveryMachine(everyMachine);
        verify(agentVersions, never()).find(any());
    }

    @Test
    void dispatch_everyMachineNoRouteOpen_nothingSentAndReportedSo() {
        // setup
        when(engine.canReachEveryMachine(DeliveryType.CLIENT_UPDATE)).thenReturn(false);
        when(legacy.canReachEveryMachine(DeliveryType.CLIENT_UPDATE)).thenReturn(false);

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
}
