package com.openframe.api.service;

import com.openframe.api.dto.force.response.ForceAgentStatus;
import com.openframe.api.dto.force.response.ForceClientUpdateResponse;
import com.openframe.api.dto.force.response.ForceClientUpdateResponseItem;
import com.openframe.api.dto.update.ForceClientUpdateRequest;
import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.nats.delivery.ClientUpdateDeliverySeed;
import com.openframe.data.nats.publisher.OpenFrameClientUpdatePublisher;
import com.openframe.data.repository.clientconfiguration.OpenFrameClientConfigurationRepository;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import com.openframe.delivery.spec.DeliveryAudience;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ForceClientUpdateServiceTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String OTHER_MACHINE_ID = "mach-43";

    @Mock private OpenFrameClientConfigurationRepository clientConfigurationRepository;
    @Mock private OpenFrameClientUpdatePublisher clientUpdatePublisher;
    @Mock private MachineRepository machineRepository;
    @Mock private DeliveryProperties deliveryProperties;
    @Mock private DeliveryDispatcher deliveryDispatcher;
    @Captor private ArgumentCaptor<ClientUpdateDeliverySeed> seedCaptor;
    @InjectMocks private ForceClientUpdateService service;

    private OpenFrameClientConfiguration configuration;
    private ForceClientUpdateRequest request;

    @BeforeEach
    void setUp() {
        configuration = OpenFrameClientConfiguration.builder().version("1.5.40").build();
        request = new ForceClientUpdateRequest();
        request.setMachineId(List.of(MACHINE_ID));
        when(clientConfigurationRepository.findFirstByOrderByCreatedAtDesc()).thenReturn(Optional.of(configuration));
    }

    @Test
    void process_typeOff_broadcastAsBefore() {
        // setup
        when(deliveryProperties.isEnabled(DeliveryType.CLIENT_UPDATE)).thenReturn(false);

        // execution
        ForceClientUpdateResponse response = service.process(request);

        // verifications
        verify(clientUpdatePublisher).send(configuration);
        verify(deliveryDispatcher, never()).dispatch(any());
        assertThat(response.getItems()).extracting(ForceClientUpdateResponseItem::getStatus).containsExactly(ForceAgentStatus.PROCESSED);
    }

    @Test
    void process_typeOnTheEngine_updateHandedToThatMachine() {
        // setup
        when(deliveryProperties.isEnabled(DeliveryType.CLIENT_UPDATE)).thenReturn(true);

        // execution
        ForceClientUpdateResponse response = service.process(request);

        // verifications
        verify(deliveryDispatcher).dispatch(seedCaptor.capture());
        ClientUpdateDeliverySeed seed = seedCaptor.getValue();
        assertThat(seed.getAudience()).isEqualTo(DeliveryAudience.MACHINE);
        assertThat(seed.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(seed.getConfiguration()).isSameAs(configuration);
        verify(clientUpdatePublisher, never()).send(any());
        assertThat(response.getItems()).extracting(ForceClientUpdateResponseItem::getStatus).containsExactly(ForceAgentStatus.PROCESSED);
    }

    @Test
    void processAll_typeOnTheEngine_oneHandOffForEveryMachineAndEveryMachineListed() {
        // setup
        when(deliveryProperties.isEnabled(DeliveryType.CLIENT_UPDATE)).thenReturn(true);
        when(machineRepository.findAll()).thenReturn(List.of(machine(MACHINE_ID), machine(OTHER_MACHINE_ID)));

        // execution
        ForceClientUpdateResponse response = service.processAll();

        // verifications
        verify(deliveryDispatcher).dispatch(seedCaptor.capture());
        ClientUpdateDeliverySeed seed = seedCaptor.getValue();
        assertThat(seed.getAudience()).isEqualTo(DeliveryAudience.EVERY_MACHINE);
        assertThat(seed.getMachineId()).isNull();
        assertThat(response.getItems()).extracting(ForceClientUpdateResponseItem::getMachineId).containsExactly(MACHINE_ID, OTHER_MACHINE_ID);
        assertThat(response.getItems()).extracting(ForceClientUpdateResponseItem::getStatus).containsOnly(ForceAgentStatus.PROCESSED);
    }

    @Test
    void processAll_handOffFails_everyMachineReportedFailed() {
        // setup
        when(deliveryProperties.isEnabled(DeliveryType.CLIENT_UPDATE)).thenReturn(true);
        when(machineRepository.findAll()).thenReturn(List.of(machine(MACHINE_ID)));
        doThrow(new IllegalStateException("kafka down")).when(deliveryDispatcher).dispatch(any());

        // execution
        ForceClientUpdateResponse response = service.processAll();

        // verifications
        assertThat(response.getItems()).extracting(ForceClientUpdateResponseItem::getStatus).containsExactly(ForceAgentStatus.FAILED);
    }

    private static Machine machine(String machineId) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        return machine;
    }
}
