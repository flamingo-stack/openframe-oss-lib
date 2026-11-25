package com.openframe.data.service;

import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.nats.delivery.ToolInstallationDeliverySeed;
import com.openframe.data.nats.delivery.route.DeviceCommandSender;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.machine.WithheldToolAgents;
import com.openframe.delivery.spec.DeliverySeed;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

import static com.openframe.data.document.audit.AuditAction.DEVICE_TOOL_AGENT_INSTALL;
import static com.openframe.data.document.audit.AuditAction.DEVICE_TOOL_AGENT_REINSTALL;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ToolInstallationServiceTest {

    private static final String MACHINE_ID = "m-1";
    private static final String AGENT_KEY = "fleetmdm-agent";
    private static final String TOOL_ID = "fleetmdm-server";
    private static final Map<String, Object> AGENT_DETAILS = Map.of("toolAgentIds", List.of(AGENT_KEY));
    private static final List<String> INSTALL_ARGS = List.of("install", "${server.registrationSecret}");
    private static final List<String> RESOLVED_INSTALL_ARGS = List.of("install", "secret");
    private static final List<String> RUN_ARGS = List.of("--enroll-secret", "${server.registrationSecret}");
    private static final List<String> RESOLVED_RUN_ARGS = List.of("--enroll-secret", "secret");

    @Mock private IntegratedToolService integratedToolService;
    @Mock private ToolCommandParamsResolver toolCommandParamsResolver;
    @Mock private DeviceCommandSender deviceCommandSender;
    @Mock private MachineRepository machineRepository;
    @Mock private WithheldToolAgents withheldToolAgents;

    @Captor private ArgumentCaptor<Supplier<DeliverySeed>> commandCaptor;

    @InjectMocks private ToolInstallationService service;

    private IntegratedToolAgent agent;
    private IntegratedTool tool;
    private Machine machine;

    @BeforeEach
    void setUp() {
        DownloadConfiguration macos = new DownloadConfiguration();
        macos.setOs("macos");
        macos.setMinOsVersion("13.0");
        agent = new IntegratedToolAgent();
        agent.setKey(AGENT_KEY);
        agent.setToolId(TOOL_ID);
        agent.setDownloadConfigurations(List.of(macos));
        agent.setInstallationCommandArgs(INSTALL_ARGS);
        agent.setRunCommandArgs(RUN_ARGS);
        tool = new IntegratedTool();
        tool.setId("tool-uuid");
        tool.setToolType("FLEET_MDM");
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setOsType(OsType.MAC_OS);
        machine.setOsVersion("14.2");
    }

    @Test
    void process_machineBelowMinimum_notSupportedReturned() {
        machine.setOsVersion("11.7.10");
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        ToolInstallationOutcome outcome = service.process(MACHINE_ID, agent);

        assertThat(outcome).isEqualTo(ToolInstallationOutcome.NOT_SUPPORTED);
    }

    @Test
    void process_machineBelowMinimum_agentWithheld() {
        machine.setOsVersion("11.7.10");
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        service.process(MACHINE_ID, agent);

        verify(withheldToolAgents).withhold(machine, AGENT_KEY);
    }

    @Test
    void process_machineBelowMinimum_nothingResolvedOrSent() {
        machine.setOsVersion("11.7.10");
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        service.process(MACHINE_ID, agent);

        verifyNoInteractions(deviceCommandSender, toolCommandParamsResolver, integratedToolService);
    }

    @Test
    void process_supportedMachine_sentAsAnInstallWithResolvedArgsAndTool() {
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        stubSend(DEVICE_TOOL_AGENT_INSTALL, true);
        stubCommandParts();

        ToolInstallationOutcome outcome = service.process(MACHINE_ID, agent);

        assertThat(outcome).isEqualTo(ToolInstallationOutcome.DISPATCHED);
        ToolInstallationDeliverySeed seed = sentCommand(DEVICE_TOOL_AGENT_INSTALL);
        assertThat(seed)
                .extracting(ToolInstallationDeliverySeed::getMachineId, ToolInstallationDeliverySeed::getTool,
                        ToolInstallationDeliverySeed::isReinstall)
                .containsExactly(MACHINE_ID, tool, false);
        assertThat(seed.getToolAgent())
                .extracting(IntegratedToolAgent::getInstallationCommandArgs, IntegratedToolAgent::getRunCommandArgs)
                .containsExactly(RESOLVED_INSTALL_ARGS, RESOLVED_RUN_ARGS);
        verify(withheldToolAgents, never()).withhold(any(Machine.class), anyString());
    }

    @Test
    void process_reinstallRequested_sentAsAReinstall() {
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        stubSend(DEVICE_TOOL_AGENT_REINSTALL, true);
        stubCommandParts();

        ToolInstallationOutcome outcome = service.process(MACHINE_ID, agent, true);

        assertThat(outcome).isEqualTo(ToolInstallationOutcome.DISPATCHED);
        assertThat(sentCommand(DEVICE_TOOL_AGENT_REINSTALL).isReinstall()).isTrue();
    }

    @Test
    void process_unknownOsVersion_dispatched() {
        machine.setOsVersion(null);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        stubSend(DEVICE_TOOL_AGENT_INSTALL, true);

        ToolInstallationOutcome outcome = service.process(MACHINE_ID, agent);

        assertThat(outcome).isEqualTo(ToolInstallationOutcome.DISPATCHED);
        verify(withheldToolAgents, never()).withhold(any(Machine.class), anyString());
    }

    @Test
    void process_unknownMachine_dispatched() {
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());
        stubSend(DEVICE_TOOL_AGENT_INSTALL, true);

        ToolInstallationOutcome outcome = service.process(MACHINE_ID, agent);

        assertThat(outcome).isEqualTo(ToolInstallationOutcome.DISPATCHED);
        verify(withheldToolAgents, never()).withhold(any(Machine.class), anyString());
    }

    @Test
    void process_noRouteCarriesTheInstall_notCarriedReturned() {
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        stubSend(DEVICE_TOOL_AGENT_INSTALL, false);

        ToolInstallationOutcome outcome = service.process(MACHINE_ID, agent);

        assertThat(outcome).isEqualTo(ToolInstallationOutcome.NOT_CARRIED);
    }

    @Test
    void process_sendFails_failedReturned() {
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(deviceCommandSender.send(eq(DEVICE_TOOL_AGENT_INSTALL), eq(MACHINE_ID), eq(AGENT_DETAILS), any()))
                .thenThrow(new IllegalStateException("nats down"));

        ToolInstallationOutcome outcome = service.process(MACHINE_ID, agent);

        assertThat(outcome).isEqualTo(ToolInstallationOutcome.FAILED);
    }

    @Test
    void process_toolMissing_theCommandCannotBeBuilt() {
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        stubSend(DEVICE_TOOL_AGENT_INSTALL, true);
        when(integratedToolService.getToolByKey(TOOL_ID)).thenReturn(Optional.empty());
        service.process(MACHINE_ID, agent);
        verify(deviceCommandSender).send(eq(DEVICE_TOOL_AGENT_INSTALL), eq(MACHINE_ID), eq(AGENT_DETAILS),
                commandCaptor.capture());

        assertThatThrownBy(() -> commandCaptor.getValue().get())
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("No tool found:fleetmdm-server");
    }

    @Test
    void process_agentWithoutTool_emptyToolSentWithoutToolLookup() {
        agent.setToolId(null);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        stubSend(DEVICE_TOOL_AGENT_INSTALL, true);
        when(toolCommandParamsResolver.process(null, INSTALL_ARGS)).thenReturn(RESOLVED_INSTALL_ARGS);
        when(toolCommandParamsResolver.process(null, RUN_ARGS)).thenReturn(RESOLVED_RUN_ARGS);

        ToolInstallationOutcome outcome = service.process(MACHINE_ID, agent);

        assertThat(outcome).isEqualTo(ToolInstallationOutcome.DISPATCHED);
        assertThat(sentCommand(DEVICE_TOOL_AGENT_INSTALL).getTool())
                .extracting(IntegratedTool::getId, IntegratedTool::getType)
                .containsExactly("", "");
        verifyNoInteractions(integratedToolService);
    }

    private void stubSend(AuditAction action, boolean sent) {
        when(deviceCommandSender.send(eq(action), eq(MACHINE_ID), eq(AGENT_DETAILS), any())).thenReturn(sent);
    }

    private void stubCommandParts() {
        when(integratedToolService.getToolByKey(TOOL_ID)).thenReturn(Optional.of(tool));
        when(toolCommandParamsResolver.process(TOOL_ID, INSTALL_ARGS)).thenReturn(RESOLVED_INSTALL_ARGS);
        when(toolCommandParamsResolver.process(TOOL_ID, RUN_ARGS)).thenReturn(RESOLVED_RUN_ARGS);
    }

    private ToolInstallationDeliverySeed sentCommand(AuditAction action) {
        verify(deviceCommandSender).send(eq(action), eq(MACHINE_ID), eq(AGENT_DETAILS), commandCaptor.capture());
        return (ToolInstallationDeliverySeed) commandCaptor.getValue().get();
    }
}
