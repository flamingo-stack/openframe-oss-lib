package com.openframe.data.service;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.UnsupportedTool;
import com.openframe.data.service.ToolOsSupportService.AgentWithToolType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ToolOsSupportServiceTest {

    private static final String AGENT_KEY = "fleetmdm-agent";
    private static final String TOOL_ID = "fleetmdm-server";
    private static final String MACOS_MINIMUM = "13.0";
    private static final String OLD_MAC_VERSION = "11.7.10";

    @Mock private IntegratedToolAgentService integratedToolAgentService;
    @Mock private IntegratedToolService integratedToolService;

    @InjectMocks private ToolOsSupportService service;

    private IntegratedToolAgent agent;
    private IntegratedTool tool;
    private Machine machine;

    @BeforeEach
    void setUp() {
        agent = new IntegratedToolAgent();
        agent.setKey(AGENT_KEY);
        agent.setToolId(TOOL_ID);
        agent.setDownloadConfigurations(List.of(
                downloadConfiguration("windows", null),
                downloadConfiguration("macos", MACOS_MINIMUM)));
        tool = new IntegratedTool();
        tool.setToolType("FLEET_MDM");
        machine = new Machine();
        machine.setMachineId("m-1");
        machine.setOsType(OsType.MAC_OS);
        machine.setOsVersion(OLD_MAC_VERSION);
    }

    @ParameterizedTest
    @ValueSource(strings = {"FLEET_MDM", "fleet_mdm", "Fleet_Mdm"})
    void agentsWithMinOsVersion_agentWithMinimumAndResolvableToolType_kept(String toolType) {
        // setup
        tool.setToolType(toolType);
        stubEnabledAgentWithTool();

        // execution
        List<AgentWithToolType> agents = service.agentsWithMinOsVersion();

        // verifications
        assertThat(agents).containsExactly(new AgentWithToolType(agent, ToolType.FLEET_MDM));
    }

    @Test
    void agentsWithToolType_agentWithoutMinimum_kept() {
        // setup
        agent.setDownloadConfigurations(List.of(downloadConfiguration("macos", null)));
        stubEnabledAgentWithTool();

        // execution
        List<AgentWithToolType> agents = service.agentsWithToolType();

        // verifications
        assertThat(agents).containsExactly(new AgentWithToolType(agent, ToolType.FLEET_MDM));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void agentsWithToolType_agentWithoutToolId_skippedWithoutToolLookup(String toolId) {
        // setup
        agent.setToolId(toolId);
        when(integratedToolAgentService.getAllEnabled()).thenReturn(List.of(agent));

        // execution
        List<AgentWithToolType> agents = service.agentsWithToolType();

        // verifications
        assertThat(agents).isEmpty();
        verify(integratedToolService, never()).getToolByKey(any());
    }

    @Test
    void agentsWithToolType_unknownToolType_skipped() {
        // setup
        tool.setToolType("NOT_A_TOOL");
        stubEnabledAgentWithTool();

        // execution
        List<AgentWithToolType> agents = service.agentsWithToolType();

        // verifications
        assertThat(agents).isEmpty();
    }

    @Test
    void agentsWithMinOsVersion_agentWithoutMinimum_skippedWithoutToolLookup() {
        // setup
        agent.setDownloadConfigurations(List.of(downloadConfiguration("macos", null)));
        when(integratedToolAgentService.getAllEnabled()).thenReturn(List.of(agent));

        // execution
        List<AgentWithToolType> agents = service.agentsWithMinOsVersion();

        // verifications
        assertThat(agents).isEmpty();
        verify(integratedToolService, never()).getToolByKey(anyString());
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " ", "NOT_A_TOOL"})
    void agentsWithMinOsVersion_unknownOrBlankToolType_skipped(String toolType) {
        // setup
        tool.setToolType(toolType);
        stubEnabledAgentWithTool();

        // execution
        List<AgentWithToolType> agents = service.agentsWithMinOsVersion();

        // verifications
        assertThat(agents).isEmpty();
    }

    @Test
    void agentsWithMinOsVersion_toolMissing_skipped() {
        // setup
        when(integratedToolAgentService.getAllEnabled()).thenReturn(List.of(agent));
        when(integratedToolService.getToolByKey(TOOL_ID)).thenReturn(Optional.empty());

        // execution
        List<AgentWithToolType> agents = service.agentsWithMinOsVersion();

        // verifications
        assertThat(agents).isEmpty();
    }

    @Test
    void unsupportedTools_machineBelowMinimum_entryWithAgentToolTypeMinimumAndVersion() {
        // setup
        stubEnabledAgentWithTool();

        // execution
        List<UnsupportedTool> unsupported = service.unsupportedTools(machine);

        // verifications
        assertThat(unsupported)
                .extracting(UnsupportedTool::getToolAgentId, UnsupportedTool::getToolType,
                        UnsupportedTool::getMinOsVersion, UnsupportedTool::getOsVersion)
                .containsExactly(tuple(AGENT_KEY, ToolType.FLEET_MDM, MACOS_MINIMUM, OLD_MAC_VERSION));
    }

    @Test
    void unsupportedTools_machineAtMinimum_empty() {
        // setup
        machine.setOsVersion(MACOS_MINIMUM);
        List<AgentWithToolType> agents = List.of(new AgentWithToolType(agent, ToolType.FLEET_MDM));

        // execution
        List<UnsupportedTool> unsupported = service.unsupportedTools(machine, agents);

        // verifications
        assertThat(unsupported).isEmpty();
    }

    @Test
    void unsupportedTools_windowsMachine_empty() {
        // setup
        machine.setOsType(OsType.WINDOWS);
        List<AgentWithToolType> agents = List.of(new AgentWithToolType(agent, ToolType.FLEET_MDM));

        // execution
        List<UnsupportedTool> unsupported = service.unsupportedTools(machine, agents);

        // verifications
        assertThat(unsupported).isEmpty();
    }

    @Test
    void unsupportedToolTypes_machineBelowMinimum_toolTypeReturned() {
        // setup
        stubEnabledAgentWithTool();

        // execution
        Set<ToolType> types = service.unsupportedToolTypes(machine);

        // verifications
        assertThat(types).containsExactly(ToolType.FLEET_MDM);
    }

    @Test
    void unsupportedToolTypes_machineAboveMinimum_empty() {
        // setup
        machine.setOsVersion("14.2");
        stubEnabledAgentWithTool();

        // execution
        Set<ToolType> types = service.unsupportedToolTypes(machine);

        // verifications
        assertThat(types).isEmpty();
    }

    @Test
    void findToolType_toolKnown_toolTypeReturned() {
        // setup
        when(integratedToolService.getToolByKey(TOOL_ID)).thenReturn(Optional.of(tool));

        // execution
        Optional<ToolType> toolType = service.findToolType(agent);

        // verifications
        assertThat(toolType).contains(ToolType.FLEET_MDM);
    }

    @Test
    void findToolType_toolMissing_empty() {
        // setup
        when(integratedToolService.getToolByKey(TOOL_ID)).thenReturn(Optional.empty());

        // execution
        Optional<ToolType> toolType = service.findToolType(agent);

        // verifications
        assertThat(toolType).isEmpty();
    }

    private void stubEnabledAgentWithTool() {
        when(integratedToolAgentService.getAllEnabled()).thenReturn(List.of(agent));
        when(integratedToolService.getToolByKey(TOOL_ID)).thenReturn(Optional.of(tool));
    }

    private static DownloadConfiguration downloadConfiguration(String os, String minOsVersion) {
        DownloadConfiguration configuration = new DownloadConfiguration();
        configuration.setOs(os);
        configuration.setMinOsVersion(minOsVersion);
        return configuration;
    }
}
