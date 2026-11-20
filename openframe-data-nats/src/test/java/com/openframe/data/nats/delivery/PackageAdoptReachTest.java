package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PackageAdoptReachTest {

    private static final String MAC = "mac-1";
    private static final String OTHER_MAC = "mac-2";
    private static final String OLD_AGENT_MAC = "mac-3";

    @Mock private DeliveryRouter deliveryRouter;

    @InjectMocks private PackageAdoptReach packageAdoptReach;

    @Test
    void isReachable_routerReachesTheDeviceWithAnAdoptOrder_true() {
        // setup
        when(deliveryRouter.reaches(DeliveryType.PACKAGE_ADOPT, MAC)).thenReturn(true);

        // execution
        boolean reachable = packageAdoptReach.isReachable(MAC);

        // verifications
        assertThat(reachable).isTrue();
    }

    @Test
    void isReachable_typeOffOrAgentBelowTheFloor_false() {
        // setup
        when(deliveryRouter.reaches(DeliveryType.PACKAGE_ADOPT, MAC)).thenReturn(false);

        // execution
        boolean reachable = packageAdoptReach.isReachable(MAC);

        // verifications
        assertThat(reachable).isFalse();
    }

    @Test
    void filterReachable_someDevicesOutOfReach_theRestInTheOrderGiven() {
        // setup
        List<String> machineIds = List.of(OTHER_MAC, OLD_AGENT_MAC, MAC);
        when(deliveryRouter.reachable(DeliveryType.PACKAGE_ADOPT, machineIds)).thenReturn(Set.of(MAC, OTHER_MAC));

        // execution
        List<String> reachable = packageAdoptReach.filterReachable(machineIds);

        // verifications
        assertThat(reachable).containsExactly(OTHER_MAC, MAC);
    }
}
