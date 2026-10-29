package com.openframe.data.nats.delivery.route;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.delivery.ClientUninstallDeliverySeed;
import com.openframe.delivery.agent.AgentVersionFloor;
import com.openframe.delivery.agent.AgentVersionFloorResolver;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliverySeed;
import com.openframe.delivery.spec.DeliverySpec;
import com.openframe.delivery.spec.DeliverySpecRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.EnumSet;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EngineDeliveryRouteTest {

    @Mock private DeliverySpecRegistry specs;
    @Mock private AgentVersionFloorResolver floors;
    @Mock private DeliveryDispatcher dispatcher;
    @Mock private DeliverySpec<DeliverySeed, DeliveryPayload> spec;

    private DeliveryProperties properties;
    private EngineDeliveryRoute route;

    @BeforeEach
    void setUp() {
        properties = new DeliveryProperties();
        route = new EngineDeliveryRoute(specs, properties, floors, dispatcher);
    }

    @Test
    void covers_everyTypeWithASpec_generationOne() {
        // setup
        when(specs.types()).thenReturn(EnumSet.of(DeliveryType.CLIENT_UNINSTALL, DeliveryType.PACKAGE_UPDATE));

        // execution + verifications
        assertThat(route.getTypes()).containsExactly(DeliveryType.CLIENT_UNINSTALL, DeliveryType.PACKAGE_UPDATE);
        assertThat(route.getGeneration()).isEqualTo(1);
    }

    @Test
    void canReach_typeOffInThisEnvironment_noMachineWhateverTheFloor() {
        // execution + verifications
        assertThat(route.canReach(DeliveryType.CLIENT_UNINSTALL, "9.9.9")).isFalse();
        assertThat(route.canReachEveryMachine(DeliveryType.CLIENT_UPDATE)).isFalse();
        verifyNoInteractions(floors, specs);
    }

    @Test
    void canReach_typeOn_theFloorDecides() {
        // setup
        properties.getEnabled().put(DeliveryType.CLIENT_UNINSTALL, true);
        when(floors.of(DeliveryType.CLIENT_UNINSTALL)).thenReturn(AgentVersionFloor.from("1.6.0"));

        // execution + verifications
        assertThat(route.canReach(DeliveryType.CLIENT_UNINSTALL, "1.6.0")).isTrue();
        assertThat(route.canReach(DeliveryType.CLIENT_UNINSTALL, "1.5.9")).isFalse();
    }

    @Test
    void canReachEveryMachine_rolledOutTypeOn_yesWhateverTheFloorTheWalkAppliesIt() {
        // setup
        properties.getEnabled().put(DeliveryType.CLIENT_UPDATE, true);
        doReturn(spec).when(specs).require(DeliveryType.CLIENT_UPDATE);
        when(spec.canDeliverToEveryMachine()).thenReturn(true);

        // execution + verifications
        assertThat(route.canReachEveryMachine(DeliveryType.CLIENT_UPDATE)).isTrue();
        verifyNoInteractions(floors);
    }

    @Test
    void canReachEveryMachine_typeDeliversToOneMachineAtATime_no() {
        // setup
        properties.getEnabled().put(DeliveryType.CLIENT_UNINSTALL, true);
        doReturn(spec).when(specs).require(DeliveryType.CLIENT_UNINSTALL);
        when(spec.canDeliverToEveryMachine()).thenReturn(false);

        // execution + verifications
        assertThat(route.canReachEveryMachine(DeliveryType.CLIENT_UNINSTALL)).isFalse();
        verifyNoInteractions(floors);
    }

    @Test
    void send_handedToTheDispatcherAsIs() {
        // setup
        ClientUninstallDeliverySeed seed = new ClientUninstallDeliverySeed("mach-42");

        // execution
        route.send(seed);
        route.sendToEveryMachine(seed);

        // verifications
        verify(dispatcher, times(2)).dispatch(seed);
    }
}
