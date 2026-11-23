package com.openframe.data.service;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.nats.delivery.ToolInstallationDeliverySeed;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
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
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ToolInstallationServiceTest {

    private static final String MACHINE_ID = "m-1";
    private static final String AGENT_KEY = "fleetmdm-agent";
    private static final String TOOL_ID = "fleetmdm-server";
    private static final List<String> INSTALL_ARGS = List.of("install", "${server.registrationSecret}");
    private static final List<String> RESOLVED_INSTALL_ARGS = List.of("install", "secret");
    private static final List<String> RUN_ARGS = List.of("--enroll-secret", "${server.registrationSecret}");
    private static final List<String> RESOLVED_RUN_ARGS = List.of("--enroll-secret", "secret");

    @Mock private IntegratedToolService integratedToolService;
    @Mock private ToolCommandParamsResolver toolCommandParamsResolver;
    @Mock private DeliveryRouter deliveryRouter;
    @Mock private MachineRepository machineRepository;
    @Mock private WithheldToolAgents withheldToolAgents;

    @Captor private ArgumentCaptor<ToolInstallationDeliverySeed> seedCaptor;

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
        // setup
        machine.setOsVersion("11.7.10");
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        ToolInstallationOutcome outcome = service.process(MACHINE_ID, agent);

        // verifications
        assertThat(outcome).isEqualTo(ToolInstallationOutcome.NOT_SUPPORTED);
    }

    @Test
    void process_machineBelowMinimum_agentWithheld() {
        // setup
        machine.setOsVersion("11.7.10");
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        service.process(MACHINE_ID, agent);

        // verifications
        verify(withheldToolAgents).withhold(machine, AGENT_KEY);
    }

    @Test
    void process_machineBelowMinimum_nothingResolvedOrDispatched() {
        // setup
        machine.setOsVersion("11.7.10");
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        service.process(MACHINE_ID, agent);

        // verifications
        verifyNoInteractions(deliveryRouter, toolCommandParamsResolver, integratedToolService);
    }

    @Test
    void process_supportedMachine_dispatchedWithResolvedArgsAndTool() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        stubDispatch(true);

        // execution
        ToolInstallationOutcome outcome = service.process(MACHINE_ID, agent);

        // verifications
        assertThat(outcome).isEqualTo(ToolInstallationOutcome.DISPATCHED);
        verify(deliveryRouter).dispatch(seedCaptor.capture());
        assertThat(seedCaptor.getValue())
                .extracting(ToolInstallationDeliverySeed::getMachineId, ToolInstallationDeliverySeed::getTool,
                        ToolInstallationDeliverySeed::isReinstall)
                .containsExactly(MACHINE_ID, tool, false);
        assertThat(seedCaptor.getValue().getToolAgent())
                .extracting(IntegratedToolAgent::getInstallationCommandArgs, IntegratedToolAgent::getRunCommandArgs)
                .containsExactly(RESOLVED_INSTALL_ARGS, RESOLVED_RUN_ARGS);
        verify(withheldToolAgents, never()).withhold(any(Machine.class), anyString());
    }

    @Test
    void process_reinstallRequested_seedMarkedAsReinstall() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        stubDispatch(true);

        // execution
        service.process(MACHINE_ID, agent, true);

        // verifications
        verify(deliveryRouter).dispatch(seedCaptor.capture());
        assertThat(seedCaptor.getValue().isReinstall()).isTrue();
    }

    @Test
    void process_unknownOsVersion_dispatched() {
        // setup
        machine.setOsVersion(null);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        stubDispatch(true);

        // execution
        ToolInstallationOutcome outcome = service.process(MACHINE_ID, agent);

        // verifications
        assertThat(outcome).isEqualTo(ToolInstallationOutcome.DISPATCHED);
        verify(withheldToolAgents, never()).withhold(any(Machine.class), anyString());
    }

    @Test
    void process_unknownMachine_dispatched() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());
        stubDispatch(true);

        // execution
        ToolInstallationOutcome outcome = service.process(MACHINE_ID, agent);

        // verifications
        assertThat(outcome).isEqualTo(ToolInstallationOutcome.DISPATCHED);
        verify(withheldToolAgents, never()).withhold(any(Machine.class), anyString());
    }

    @Test
    void process_noRouteCarriesTheInstall_notCarriedReturned() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        stubDispatch(false);

        // execution
        ToolInstallationOutcome outcome = service.process(MACHINE_ID, agent);

        // verifications
        assertThat(outcome).isEqualTo(ToolInstallationOutcome.NOT_CARRIED);
    }

    @Test
    void process_toolMissing_failedReturnedAndNothingDispatched() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(integratedToolService.getToolByKey(TOOL_ID)).thenReturn(Optional.empty());

        // execution
        ToolInstallationOutcome outcome = service.process(MACHINE_ID, agent);

        // verifications
        assertThat(outcome).isEqualTo(ToolInstallationOutcome.FAILED);
        verify(deliveryRouter, never()).dispatch(any(DeliverySeed.class));
    }

    @Test
    void process_dispatchThrows_failedReturned() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(integratedToolService.getToolByKey(TOOL_ID)).thenReturn(Optional.of(tool));
        when(toolCommandParamsResolver.process(TOOL_ID, INSTALL_ARGS)).thenReturn(RESOLVED_INSTALL_ARGS);
        when(toolCommandParamsResolver.process(TOOL_ID, RUN_ARGS)).thenReturn(RESOLVED_RUN_ARGS);
        when(deliveryRouter.dispatch(any(ToolInstallationDeliverySeed.class))).thenThrow(new IllegalStateException("nats down"));

        // execution
        ToolInstallationOutcome outcome = service.process(MACHINE_ID, agent);

        // verifications
        assertThat(outcome).isEqualTo(ToolInstallationOutcome.FAILED);
    }

    @Test
    void process_agentWithoutTool_emptyToolDispatchedWithoutToolLookup() {
        // setup
        agent.setToolId(null);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(toolCommandParamsResolver.process(null, INSTALL_ARGS)).thenReturn(RESOLVED_INSTALL_ARGS);
        when(toolCommandParamsResolver.process(null, RUN_ARGS)).thenReturn(RESOLVED_RUN_ARGS);
        when(deliveryRouter.dispatch(any(ToolInstallationDeliverySeed.class))).thenReturn(true);

        // execution
        ToolInstallationOutcome outcome = service.process(MACHINE_ID, agent);

        // verifications
        assertThat(outcome).isEqualTo(ToolInstallationOutcome.DISPATCHED);
        verify(deliveryRouter).dispatch(seedCaptor.capture());
        assertThat(seedCaptor.getValue().getTool())
                .extracting(IntegratedTool::getId, IntegratedTool::getType)
                .containsExactly("", "");
        verifyNoInteractions(integratedToolService);
    }

    private void stubDispatch(boolean carried) {
        when(integratedToolService.getToolByKey(TOOL_ID)).thenReturn(Optional.of(tool));
        when(toolCommandParamsResolver.process(TOOL_ID, INSTALL_ARGS)).thenReturn(RESOLVED_INSTALL_ARGS);
        when(toolCommandParamsResolver.process(TOOL_ID, RUN_ARGS)).thenReturn(RESOLVED_RUN_ARGS);
        when(deliveryRouter.dispatch(any(ToolInstallationDeliverySeed.class))).thenReturn(carried);
    }
}
