package com.openframe.data.nats.delivery;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.nats.mapper.OpenFrameClientUpdateMessageMapper;
import com.openframe.data.nats.model.OpenFrameClientUpdateMessage;
import com.openframe.delivery.spec.DeliveryAudience;
import com.openframe.delivery.spec.DeliveryRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClientUpdateDeliverySpecTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String VERSION = "1.5.40";

    @Mock private OpenFrameClientUpdateMessageMapper messageMapper;

    private ClientUpdateDeliverySpec spec;
    private OpenFrameClientConfiguration configuration;
    private OpenFrameClientUpdateMessage message;

    @BeforeEach
    void setUp() {
        spec = new ClientUpdateDeliverySpec(messageMapper);
        configuration = OpenFrameClientConfiguration.builder().version(VERSION).build();
        message = new OpenFrameClientUpdateMessage();
        message.setVersion(VERSION);
    }

    @Test
    void request_seedForOneMachine_requestToThatMachineWithTheMappedMessage() {
        // setup
        when(messageMapper.toMessage(configuration)).thenReturn(message);
        ClientUpdateDeliverySeed seed = ClientUpdateDeliverySeed.forMachine(MACHINE_ID, configuration);

        // execution
        DeliveryRequest<OpenFrameClientUpdateMessage> request = spec.request(seed);

        // verifications
        assertThat(request.getType()).isEqualTo(DeliveryType.CLIENT_UPDATE);
        assertThat(request.getTargetId()).isEqualTo("openframe-client");
        assertThat(request.getAudience()).isEqualTo(DeliveryAudience.MACHINE);
        assertThat(request.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(request.getPayload()).isSameAs(message);
        assertThat(request.getPayload().getDelivery()).isNull();
    }

    @Test
    void request_seedForEveryMachine_requestForEveryMachineWithoutAMachine() {
        // setup
        when(messageMapper.toMessage(configuration)).thenReturn(message);
        ClientUpdateDeliverySeed seed = ClientUpdateDeliverySeed.forEveryMachine(configuration);

        // execution
        DeliveryRequest<OpenFrameClientUpdateMessage> request = spec.request(seed);

        // verifications
        assertThat(request.isForEveryMachine()).isTrue();
        assertThat(request.getMachineId()).isNull();
        assertThat(request.getTargetId()).isEqualTo("openframe-client");
        assertThat(request.getPayload().getVersion()).isEqualTo(VERSION);
    }

    @Test
    void canDeliverToEveryMachine_clientUpdate_true() {
        // execution + verifications
        assertThat(spec.canDeliverToEveryMachine()).isTrue();
    }

    @Test
    void getDeliverableStatuses_default_machineBeingDeletedGetsNoUpdate() {
        // execution
        Set<DeviceStatus> statuses = spec.getDeliverableStatuses();

        // verifications
        assertThat(statuses).containsExactlyInAnyOrder(DeviceStatus.ONLINE, DeviceStatus.OFFLINE, DeviceStatus.PENDING);
    }

    @Test
    void subject_machineId_machineClientUpdateSubject() {
        // execution
        String subject = spec.subject(MACHINE_ID);

        // verifications
        assertThat(subject).isEqualTo("machine.mach-42.client-update.v2");
    }
}
