package com.openframe.client.service;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.ToolOsSupportService;
import com.openframe.data.service.ToolOsSupportService.AgentWithToolType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Limit;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ToolOsSupportSweepServiceTest {

    private static final String AGENT_KEY = "fleetmdm-agent";
    private static final String OLD_MAC_VERSION = "11.7.10";
    private static final String NEW_MAC_VERSION = "14.2";
    private static final Set<DeviceStatus> SWEPT =
            EnumSet.of(DeviceStatus.MANAGED, DeviceStatus.ONLINE, DeviceStatus.OFFLINE, DeviceStatus.PENDING);
    private static final Limit PAGE = Limit.of(ToolOsSupportSweepService.PAGE_SIZE);

    @Mock private ToolOsSupportService toolOsSupportService;
    @Mock private ToolOsSupportReconciler toolOsSupportReconciler;
    @Mock private MachineRepository machineRepository;

    @InjectMocks private ToolOsSupportSweepService sweepService;

    private List<AgentWithToolType> agents;

    @BeforeEach
    void setUp() {
        DownloadConfiguration macos = new DownloadConfiguration();
        macos.setOs("macos");
        macos.setMinOsVersion("13.0");
        IntegratedToolAgent agent = new IntegratedToolAgent();
        agent.setKey(AGENT_KEY);
        agent.setDownloadConfigurations(List.of(macos));
        agents = List.of(new AgentWithToolType(agent, ToolType.FLEET_MDM));
    }

    @Test
    void sweep_noAgentWithToolType_noMachineRead() {
        // setup
        when(toolOsSupportService.agentsWithToolType()).thenReturn(List.of());

        // execution
        sweepService.sweep();

        // verifications
        verifyNoInteractions(machineRepository, toolOsSupportReconciler);
    }

    @Test
    void sweep_mixedPage_onlyMachinesNeedingReconcileReconciledByReRead() {
        // setup
        Machine below = machine("id-1", "m-1", OLD_MAC_VERSION, null);
        Machine supported = machine("id-2", "m-2", NEW_MAC_VERSION, null);
        Machine withheld = machine("id-3", "m-3", NEW_MAC_VERSION, Set.of(AGENT_KEY));
        when(toolOsSupportService.agentsWithToolType()).thenReturn(agents);
        when(machineRepository.findByStatusInAndIdGreaterThanOrderByIdAsc(SWEPT, ToolOsSupportSweepService.BEFORE_FIRST_MACHINE, PAGE))
                .thenReturn(List.of(below, supported, withheld));

        // execution
        sweepService.sweep();

        // verifications
        verify(toolOsSupportReconciler).reconcileCurrent("m-1", agents);
        verify(toolOsSupportReconciler).reconcileCurrent("m-3", agents);
        verify(toolOsSupportReconciler, never()).reconcileCurrent("m-2", agents);
    }

    @Test
    void sweep_agentWithoutMinimumWithheldOnAMachine_machineReconciled() {
        // setup
        IntegratedToolAgent withoutMinimum = new IntegratedToolAgent();
        withoutMinimum.setKey(AGENT_KEY);
        List<AgentWithToolType> noMinimum = List.of(new AgentWithToolType(withoutMinimum, ToolType.FLEET_MDM));
        Machine withheld = machine("id-1", "m-1", OLD_MAC_VERSION, Set.of(AGENT_KEY));
        Machine untouched = machine("id-2", "m-2", OLD_MAC_VERSION, null);
        when(toolOsSupportService.agentsWithToolType()).thenReturn(noMinimum);
        when(machineRepository.findByStatusInAndIdGreaterThanOrderByIdAsc(SWEPT, ToolOsSupportSweepService.BEFORE_FIRST_MACHINE, PAGE))
                .thenReturn(List.of(withheld, untouched));

        // execution
        sweepService.sweep();

        // verifications
        verify(toolOsSupportReconciler).reconcileCurrent("m-1", noMinimum);
        verify(toolOsSupportReconciler, never()).reconcileCurrent("m-2", noMinimum);
    }

    @Test
    void sweep_fullPage_nextPageReadFromTheLastIdAndSweepStopsOnAShortPage() {
        // setup
        List<Machine> fullPage = supportedMachines(0, ToolOsSupportSweepService.PAGE_SIZE);
        Machine below = machine("id-9999", "m-9999", OLD_MAC_VERSION, null);
        String lastId = "id-" + (ToolOsSupportSweepService.PAGE_SIZE - 1);
        when(toolOsSupportService.agentsWithToolType()).thenReturn(agents);
        when(machineRepository.findByStatusInAndIdGreaterThanOrderByIdAsc(SWEPT, ToolOsSupportSweepService.BEFORE_FIRST_MACHINE, PAGE))
                .thenReturn(fullPage);
        when(machineRepository.findByStatusInAndIdGreaterThanOrderByIdAsc(SWEPT, lastId, PAGE))
                .thenReturn(List.of(below));

        // execution
        sweepService.sweep();

        // verifications
        verify(machineRepository).findByStatusInAndIdGreaterThanOrderByIdAsc(SWEPT, lastId, PAGE);
        verify(machineRepository, never()).findByStatusInAndIdGreaterThanOrderByIdAsc(SWEPT, "id-9999", PAGE);
        verify(toolOsSupportReconciler).reconcileCurrent("m-9999", agents);
    }

    @Test
    void sweep_fullPageThenEmptyPage_sweepStops() {
        // setup
        List<Machine> fullPage = supportedMachines(0, ToolOsSupportSweepService.PAGE_SIZE);
        String lastId = "id-" + (ToolOsSupportSweepService.PAGE_SIZE - 1);
        when(toolOsSupportService.agentsWithToolType()).thenReturn(agents);
        when(machineRepository.findByStatusInAndIdGreaterThanOrderByIdAsc(SWEPT, ToolOsSupportSweepService.BEFORE_FIRST_MACHINE, PAGE))
                .thenReturn(fullPage);
        when(machineRepository.findByStatusInAndIdGreaterThanOrderByIdAsc(SWEPT, lastId, PAGE))
                .thenReturn(List.of());

        // execution
        sweepService.sweep();

        // verifications
        verify(machineRepository).findByStatusInAndIdGreaterThanOrderByIdAsc(SWEPT, lastId, PAGE);
        verify(toolOsSupportReconciler, never()).reconcileCurrent(anyString(), anyList());
    }

    @Test
    void sweep_emptyFirstPage_nothingReconciled() {
        // setup
        when(toolOsSupportService.agentsWithToolType()).thenReturn(agents);
        when(machineRepository.findByStatusInAndIdGreaterThanOrderByIdAsc(SWEPT, ToolOsSupportSweepService.BEFORE_FIRST_MACHINE, PAGE))
                .thenReturn(List.of());

        // execution
        sweepService.sweep();

        // verifications
        verifyNoInteractions(toolOsSupportReconciler);
    }

    @Test
    void sweep_oneMachineFails_theOthersStillReconciled() {
        // setup
        Machine failing = machine("id-1", "m-1", OLD_MAC_VERSION, null);
        Machine next = machine("id-2", "m-2", OLD_MAC_VERSION, null);
        when(toolOsSupportService.agentsWithToolType()).thenReturn(agents);
        when(machineRepository.findByStatusInAndIdGreaterThanOrderByIdAsc(SWEPT, ToolOsSupportSweepService.BEFORE_FIRST_MACHINE, PAGE))
                .thenReturn(List.of(failing, next));
        doThrow(new IllegalStateException("mongo away")).when(toolOsSupportReconciler).reconcileCurrent("m-1", agents);

        // execution
        sweepService.sweep();

        // verifications
        verify(toolOsSupportReconciler).reconcileCurrent("m-2", agents);
    }

    private static List<Machine> supportedMachines(int from, int to) {
        Stream<Machine> machines = IntStream.range(from, to)
                .mapToObj(index -> machine("id-" + index, "m-" + index, NEW_MAC_VERSION, null));
        return machines.toList();
    }

    private static Machine machine(String id, String machineId, String osVersion, Set<String> withheld) {
        Machine machine = new Machine();
        machine.setId(id);
        machine.setMachineId(machineId);
        machine.setOsType(OsType.MAC_OS);
        machine.setOsVersion(osVersion);
        machine.setWithheldToolAgents(withheld);
        return machine;
    }
}
