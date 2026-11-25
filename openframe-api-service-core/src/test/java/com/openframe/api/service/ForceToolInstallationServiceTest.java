package com.openframe.api.service;

import com.openframe.api.dto.force.request.ForceToolInstallationRequest;
import com.openframe.api.dto.force.response.ForceAgentStatus;
import com.openframe.api.dto.force.response.ForceToolAgentInstallationResponse;
import com.openframe.api.dto.force.response.ForceToolAgentInstallationResponseItem;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.IntegratedToolAgentService;
import com.openframe.data.service.ToolInstallationOutcome;
import com.openframe.data.service.ToolInstallationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ForceToolInstallationServiceTest {

    private static final String MACHINE_ID = "m-1";
    private static final String AGENT_KEY = "fleetmdm-agent";

    @Mock private IntegratedToolAgentService integratedToolAgentService;
    @Mock private ToolInstallationService toolInstallationService;
    @Mock private MachineRepository machineRepository;

    @InjectMocks private ForceToolInstallationService service;

    private IntegratedToolAgent agent;
    private ForceToolInstallationRequest request;

    @BeforeEach
    void setUp() {
        agent = new IntegratedToolAgent();
        agent.setKey(AGENT_KEY);
        request = ForceToolInstallationRequest.builder()
                .toolAgentId(AGENT_KEY)
                .machineIds(List.of(MACHINE_ID))
                .build();
    }

    @Test
    void process_outcomeNotSupported_notSupportedItem() {
        // setup
        when(integratedToolAgentService.findByKey(AGENT_KEY)).thenReturn(Optional.of(agent));
        when(toolInstallationService.process(MACHINE_ID, agent, false)).thenReturn(ToolInstallationOutcome.NOT_SUPPORTED);

        // execution
        ForceToolAgentInstallationResponse response = service.process(request);

        // verifications
        assertThat(response.getItems())
                .extracting(ForceToolAgentInstallationResponseItem::getMachineId,
                        ForceToolAgentInstallationResponseItem::getToolAgentId,
                        ForceToolAgentInstallationResponseItem::getStatus)
                .containsExactly(tuple(MACHINE_ID, AGENT_KEY, ForceAgentStatus.NOT_SUPPORTED));
    }

    @Test
    void process_commandSent_answersProcessedForTheDevice() {
        when(integratedToolAgentService.findByKey(AGENT_KEY)).thenReturn(Optional.of(agent));
        when(toolInstallationService.process(MACHINE_ID, agent, false)).thenReturn(ToolInstallationOutcome.DISPATCHED);

        ForceToolAgentInstallationResponse response = service.process(request);

        assertThat(response.getItems())
                .extracting(ForceToolAgentInstallationResponseItem::getMachineId,
                        ForceToolAgentInstallationResponseItem::getStatus)
                .containsExactly(tuple(MACHINE_ID, ForceAgentStatus.PROCESSED));
    }

    @ParameterizedTest
    @EnumSource(value = ToolInstallationOutcome.class, names = {"NOT_CARRIED", "FAILED"})
    void process_commandNotSent_answersFailedForTheDevice(ToolInstallationOutcome outcome) {
        when(integratedToolAgentService.findByKey(AGENT_KEY)).thenReturn(Optional.of(agent));
        when(toolInstallationService.process(MACHINE_ID, agent, false)).thenReturn(outcome);

        ForceToolAgentInstallationResponse response = service.process(request);

        assertThat(response.getItems())
                .extracting(ForceToolAgentInstallationResponseItem::getMachineId,
                        ForceToolAgentInstallationResponseItem::getStatus)
                .containsExactly(tuple(MACHINE_ID, ForceAgentStatus.FAILED));
    }

    @Test
    void process_agentNotFound_failedItem() {
        // setup
        when(integratedToolAgentService.findByKey(AGENT_KEY)).thenReturn(Optional.empty());

        // execution
        ForceToolAgentInstallationResponse response = service.process(request);

        // verifications
        assertThat(response.getItems())
                .extracting(ForceToolAgentInstallationResponseItem::getStatus)
                .containsExactly(ForceAgentStatus.FAILED);
    }

    @Test
    void processReinstall_outcomeNotSupported_notSupportedItemAndReinstallPassed() {
        // setup
        when(integratedToolAgentService.findByKey(AGENT_KEY)).thenReturn(Optional.of(agent));
        when(toolInstallationService.process(MACHINE_ID, agent, true)).thenReturn(ToolInstallationOutcome.NOT_SUPPORTED);

        // execution
        ForceToolAgentInstallationResponse response = service.processReinstall(request);

        // verifications
        assertThat(response.getItems())
                .extracting(ForceToolAgentInstallationResponseItem::getStatus)
                .containsExactly(ForceAgentStatus.NOT_SUPPORTED);
    }

    @Test
    void processAll_everyMachine_eachProcessedWithItsOwnStatus() {
        // setup
        Machine supported = machine("m-1");
        Machine unsupported = machine("m-2");
        when(machineRepository.findAll()).thenReturn(List.of(supported, unsupported));
        when(integratedToolAgentService.findByKey(AGENT_KEY)).thenReturn(Optional.of(agent));
        when(toolInstallationService.process("m-1", agent, false)).thenReturn(ToolInstallationOutcome.DISPATCHED);
        when(toolInstallationService.process("m-2", agent, false)).thenReturn(ToolInstallationOutcome.NOT_SUPPORTED);

        // execution
        ForceToolAgentInstallationResponse response = service.processAll(AGENT_KEY);

        // verifications
        assertThat(response.getItems())
                .extracting(ForceToolAgentInstallationResponseItem::getMachineId,
                        ForceToolAgentInstallationResponseItem::getStatus)
                .containsExactly(tuple("m-1", ForceAgentStatus.PROCESSED), tuple("m-2", ForceAgentStatus.NOT_SUPPORTED));
    }

    @Test
    void processReinstallAll_everyMachine_reinstallPassed() {
        // setup
        when(machineRepository.findAll()).thenReturn(List.of(machine(MACHINE_ID)));
        when(integratedToolAgentService.findByKey(AGENT_KEY)).thenReturn(Optional.of(agent));
        when(toolInstallationService.process(MACHINE_ID, agent, true)).thenReturn(ToolInstallationOutcome.DISPATCHED);

        // execution
        service.processReinstallAll(AGENT_KEY);

        // verifications
        verify(toolInstallationService).process(MACHINE_ID, agent, true);
    }

    @Test
    void process_blankToolAgentId_throwsIllegalArgument() {
        // setup
        ForceToolInstallationRequest blankAgent = ForceToolInstallationRequest.builder()
                .toolAgentId(" ")
                .machineIds(List.of(MACHINE_ID))
                .build();

        // execution
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.process(blankAgent));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("No tool agent id provided");
    }

    @Test
    void process_noMachineIds_throwsIllegalArgument() {
        // setup
        ForceToolInstallationRequest noMachines = ForceToolInstallationRequest.builder()
                .toolAgentId(AGENT_KEY)
                .machineIds(List.of())
                .build();

        // execution
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.process(noMachines));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("No machine ids provided");
    }

    private static Machine machine(String machineId) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        return machine;
    }
}
