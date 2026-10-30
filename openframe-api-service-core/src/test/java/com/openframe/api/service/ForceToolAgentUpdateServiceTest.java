package com.openframe.api.service;

import com.openframe.api.dto.force.response.ForceAgentStatus;
import com.openframe.api.dto.force.response.ForceToolAgentUpdateResponseItem;
import com.openframe.api.dto.update.ForceToolAgentUpdateRequest;
import com.openframe.api.dto.update.ForceToolAgentUpdateResponse;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.nats.delivery.ToolUpdateDeliverySeed;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.toolagent.IntegratedToolAgentRepository;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ForceToolAgentUpdateServiceTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String OTHER_MACHINE_ID = "mach-43";
    private static final String TOOL_AGENT_KEY = "fleetmdm-agent";

    @Mock private IntegratedToolAgentRepository toolAgentRepository;
    @Mock private MachineRepository machineRepository;
    @Mock private DeliveryRouter deliveryRouter;
    @Captor private ArgumentCaptor<ToolUpdateDeliverySeed> seedCaptor;
    @InjectMocks private ForceToolAgentUpdateService service;

    private IntegratedToolAgent toolAgent;
    private ForceToolAgentUpdateRequest request;

    @BeforeEach
    void setUp() {
        toolAgent = new IntegratedToolAgent();
        toolAgent.setKey(TOOL_AGENT_KEY);
        toolAgent.setVersion("1.2.3");
        request = new ForceToolAgentUpdateRequest();
        request.setToolAgentId(TOOL_AGENT_KEY);
        request.setMachineIds(List.of(MACHINE_ID, OTHER_MACHINE_ID));
    }

    @Test
    void process_routeCarriesIt_oneDeliveryPerMachine() {
        // setup
        when(toolAgentRepository.findByKey(TOOL_AGENT_KEY)).thenReturn(Optional.of(toolAgent));
        when(deliveryRouter.dispatch(any())).thenReturn(true);

        // execution
        ForceToolAgentUpdateResponse response = service.process(request);

        // verifications
        verify(deliveryRouter, times(2)).dispatch(seedCaptor.capture());
        List<ToolUpdateDeliverySeed> seeds = seedCaptor.getAllValues();
        assertThat(seeds).extracting(ToolUpdateDeliverySeed::getMachineId).containsExactly(MACHINE_ID, OTHER_MACHINE_ID);
        assertThat(seeds).extracting(ToolUpdateDeliverySeed::getAudience).containsOnly(DeliveryAudience.MACHINE);
        assertThat(seeds).extracting(ToolUpdateDeliverySeed::getTargetId).containsOnly(TOOL_AGENT_KEY);
        assertThat(response.getItems()).extracting(ForceToolAgentUpdateResponseItem::getStatus).containsOnly(ForceAgentStatus.PROCESSED);
    }

    @Test
    void process_noRouteReachesOneMachine_thatOneFailed() {
        // setup
        when(toolAgentRepository.findByKey(TOOL_AGENT_KEY)).thenReturn(Optional.of(toolAgent));
        when(deliveryRouter.dispatch(any())).thenReturn(true, false);

        // execution
        ForceToolAgentUpdateResponse response = service.process(request);

        // verifications
        assertThat(response.getItems()).extracting(ForceToolAgentUpdateResponseItem::getStatus)
                .containsExactly(ForceAgentStatus.PROCESSED, ForceAgentStatus.FAILED);
    }

    @Test
    void processAll_oneHandOffForEveryMachineListedPerMachine() {
        // setup
        when(toolAgentRepository.findByKey(TOOL_AGENT_KEY)).thenReturn(Optional.of(toolAgent));
        when(machineRepository.findAll()).thenReturn(List.of(machine(MACHINE_ID), machine(OTHER_MACHINE_ID)));
        when(deliveryRouter.dispatch(any())).thenReturn(true);

        // execution
        ForceToolAgentUpdateResponse response = service.processAll(TOOL_AGENT_KEY);

        // verifications
        verify(deliveryRouter).dispatch(seedCaptor.capture());
        assertThat(seedCaptor.getValue().getAudience()).isEqualTo(DeliveryAudience.EVERY_MACHINE);
        assertThat(response.getItems()).extracting(ForceToolAgentUpdateResponseItem::getMachineId).containsExactly(MACHINE_ID, OTHER_MACHINE_ID);
        assertThat(response.getItems()).extracting(ForceToolAgentUpdateResponseItem::getStatus).containsOnly(ForceAgentStatus.PROCESSED);
    }

    @Test
    void processAll_handOffFails_everyMachineListedFailed() {
        // setup
        when(toolAgentRepository.findByKey(TOOL_AGENT_KEY)).thenReturn(Optional.of(toolAgent));
        when(machineRepository.findAll()).thenReturn(List.of(machine(MACHINE_ID)));
        doThrow(new IllegalStateException("kafka down")).when(deliveryRouter).dispatch(any());

        // execution
        ForceToolAgentUpdateResponse response = service.processAll(TOOL_AGENT_KEY);

        // verifications
        assertThat(response.getItems()).extracting(ForceToolAgentUpdateResponseItem::getStatus).containsExactly(ForceAgentStatus.FAILED);
    }

    @Test
    void process_noToolAgentId_rejected() {
        // setup
        request.setToolAgentId(" ");

        // execution + verifications
        assertThatThrownBy(() -> service.process(request)).isInstanceOf(IllegalArgumentException.class);
    }

    private static Machine machine(String machineId) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        return machine;
    }
}
