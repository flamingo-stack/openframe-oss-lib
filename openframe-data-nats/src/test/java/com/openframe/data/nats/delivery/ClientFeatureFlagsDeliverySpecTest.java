package com.openframe.data.nats.delivery;

import com.openframe.data.document.clientconfiguration.ClientFeatureFlag;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.nats.model.ClientFeatureFlagsMessage;
import com.openframe.delivery.spec.DeliveryAudience;
import com.openframe.delivery.spec.DeliveryRequest;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class ClientFeatureFlagsDeliverySpecTest {

    private static final String MACHINE_ID = "mach-42";
    private static final Map<String, ClientFeatureFlag> FLAGS = Map.of("delivery-tool-installation", new ClientFeatureFlag(true, "1.6.0"), "delivery-client-uninstall", new ClientFeatureFlag(false, null));

    private final ClientFeatureFlagsDeliverySpec spec = new ClientFeatureFlagsDeliverySpec();

    @Test
    void request_seedForOneMachine_requestToThatMachineCarryingTheWholeSet() {
        // setup
        ClientFeatureFlagsDeliverySeed seed = ClientFeatureFlagsDeliverySeed.forMachine(MACHINE_ID, FLAGS);

        // execution
        DeliveryRequest<ClientFeatureFlagsMessage> request = spec.request(seed);

        // verifications
        assertThat(request.getType()).isEqualTo(DeliveryType.CLIENT_FEATURE_FLAGS);
        assertThat(request.getTargetId()).isEqualTo("openframe-client");
        assertThat(request.getAudience()).isEqualTo(DeliveryAudience.MACHINE);
        assertThat(request.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(request.getPayload().getFlags()).isEqualTo(FLAGS);
        assertThat(request.getPayload().getDelivery()).isNull();
    }

    @Test
    void request_seedForEveryMachine_requestForEveryMachineWithoutAMachine() {
        // setup
        ClientFeatureFlagsDeliverySeed seed = ClientFeatureFlagsDeliverySeed.forEveryMachine(FLAGS);

        // execution
        DeliveryRequest<ClientFeatureFlagsMessage> request = spec.request(seed);

        // verifications
        assertThat(request.isForEveryMachine()).isTrue();
        assertThat(request.getMachineId()).isNull();
        assertThat(request.getPayload().getFlags()).isEqualTo(FLAGS);
    }

    @Test
    void canDeliverToEveryMachine_featureFlags_true() {
        // execution + verifications
        assertThat(spec.canDeliverToEveryMachine()).isTrue();
    }

    @Test
    void getDeliverableStatuses_default_machineBeingDeletedGetsNoFlags() {
        // execution
        Set<DeviceStatus> statuses = spec.getDeliverableStatuses();

        // verifications
        assertThat(statuses).containsExactlyInAnyOrder(DeviceStatus.ONLINE, DeviceStatus.OFFLINE, DeviceStatus.PENDING);
    }

    @Test
    void subject_machineId_machineFeatureFlagsSubject() {
        // execution
        String subject = spec.subject(MACHINE_ID);

        // verifications
        assertThat(subject).isEqualTo("machine.mach-42.feature-flags");
    }
}
