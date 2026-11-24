package com.openframe.management.initializer;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import com.openframe.data.document.toolagent.IntegratedToolAgentConfiguration;
import com.openframe.data.service.IntegratedToolAgentService;
import com.openframe.management.config.AgentConfigurationProperties;
import com.openframe.management.config.ClientVersionsProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class IntegratedToolAgentInitializerTest {

    private static final String FLEET_AGENT = "fleetmdm-agent";
    private static final String FLEET_CONFIGURATION = "agent-configurations/fleetmdm-agent.json";
    private static final String CLIENT_AGENT = "default";
    private static final String CLIENT_CONFIGURATION = "agent-configurations/client-configuration.json";
    private static final String CA_PATH = "/etc/openframe/local-ca.pem";

    @Mock private IntegratedToolAgentService integratedToolAgentService;

    @Captor private ArgumentCaptor<IntegratedToolAgentConfiguration> configurationCaptor;

    private IntegratedToolAgentInitializer initializer;
    private AgentConfigurationProperties agentConfigurationProperties;

    @BeforeEach
    void setUp() {
        agentConfigurationProperties = new AgentConfigurationProperties();
        agentConfigurationProperties.setAgentConfigurations(List.of(FLEET_CONFIGURATION));
        ClientVersionsProperties clientVersionsProperties = new ClientVersionsProperties();
        clientVersionsProperties.setFleet("4.70.0");
        clientVersionsProperties.setOsquery("5.12.0");
        initializer = new IntegratedToolAgentInitializer(new JsonMapper(), integratedToolAgentService,
                agentConfigurationProperties, clientVersionsProperties);
    }

    @Test
    void run_noOverride_macosMinimumFromTheJsonAndNoneForWindows() {
        // setup

        // execution
        initializer.run(null);

        // verifications
        verify(integratedToolAgentService).updateConfigurationFields(configurationCaptor.capture());
        assertThat(configurationCaptor.getValue().getDownloadConfigurations())
                .extracting(DownloadConfiguration::getOs, DownloadConfiguration::getMinOsVersion)
                .containsExactly(tuple("windows", null), tuple("macos", "13.0"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"macos", "MACOS", "macOS"})
    void run_macosOverride_onlyTheMacosEntrySet(String osKey) {
        // setup
        agentConfigurationProperties.setAgentMinOsVersions(Map.of(FLEET_AGENT, Map.of(osKey, "14.0")));

        // execution
        initializer.run(null);

        // verifications
        verify(integratedToolAgentService).updateConfigurationFields(configurationCaptor.capture());
        assertThat(configurationCaptor.getValue().getDownloadConfigurations())
                .extracting(DownloadConfiguration::getOs, DownloadConfiguration::getMinOsVersion)
                .containsExactly(tuple("windows", null), tuple("macos", "14.0"));
    }

    @Test
    void run_overrideForAnotherAgent_fleetKeepsTheJsonMinimum() {
        // setup
        agentConfigurationProperties.setAgentMinOsVersions(Map.of("meshcentral-agent", Map.of("macos", "14.0")));

        // execution
        initializer.run(null);

        // verifications
        verify(integratedToolAgentService).updateConfigurationFields(configurationCaptor.capture());
        assertThat(configurationCaptor.getValue().getDownloadConfigurations())
                .extracting(DownloadConfiguration::getOs, DownloadConfiguration::getMinOsVersion)
                .containsExactly(tuple("windows", null), tuple("macos", "13.0"));
    }

    @Test
    void run_overrideForAnOsTheAgentDoesNotShip_entriesUnchanged() {
        // setup
        agentConfigurationProperties.setAgentMinOsVersions(Map.of(FLEET_AGENT, Map.of("linux", "6.0")));

        // execution
        initializer.run(null);

        // verifications
        verify(integratedToolAgentService).updateConfigurationFields(configurationCaptor.capture());
        assertThat(configurationCaptor.getValue().getDownloadConfigurations())
                .extracting(DownloadConfiguration::getOs, DownloadConfiguration::getMinOsVersion)
                .containsExactly(tuple("windows", null), tuple("macos", "13.0"));
    }

    @Test
    void run_fleetConfiguration_versionsFromClientVersionsProperties() {
        // setup

        // execution
        initializer.run(null);

        // verifications
        verify(integratedToolAgentService).updateConfigurationFields(configurationCaptor.capture());
        assertThat(configurationCaptor.getValue().getVersion()).isEqualTo("4.70.0");
    }

    @Test
    void run_fleetConfiguration_runArgsKeepTlsVerification() {
        // setup

        // execution
        initializer.run(null);

        // verifications
        verify(integratedToolAgentService).updateConfigurationFields(configurationCaptor.capture());
        assertThat(configurationCaptor.getValue().getRunCommandArgs())
                .contains("--fleet-url", "--openframe-mode")
                .doesNotContain("--insecure");
    }

    @Test
    void run_extraRunArgsForFleet_appendedAfterTheJsonArgs() {
        // setup
        agentConfigurationProperties.setAgentExtraRunArgs(Map.of(FLEET_AGENT, List.of("--fleet-certificate", CA_PATH)));

        // execution
        initializer.run(null);

        // verifications
        verify(integratedToolAgentService).updateConfigurationFields(configurationCaptor.capture());
        assertThat(configurationCaptor.getValue().getRunCommandArgs())
                .startsWith("--fleet-url")
                .endsWith("--fleet-certificate", CA_PATH);
    }

    @Test
    void run_extraRunArgsForAnotherAgent_fleetRunArgsUnchanged() {
        // setup
        agentConfigurationProperties.setAgentExtraRunArgs(Map.of("meshcentral-agent", List.of("--insecure")));

        // execution
        initializer.run(null);

        // verifications
        verify(integratedToolAgentService).updateConfigurationFields(configurationCaptor.capture());
        assertThat(configurationCaptor.getValue().getRunCommandArgs())
                .endsWith("--openframe-token-path", "${client.openframeTokenPath}")
                .doesNotContain("--insecure");
    }

    @Test
    void run_extraRunArgsForAgentWithoutRunArgs_configurationStillApplied() {
        // setup
        agentConfigurationProperties.setAgentConfigurations(List.of(CLIENT_CONFIGURATION));
        agentConfigurationProperties.setAgentExtraRunArgs(Map.of(CLIENT_AGENT, List.of("--fleet-certificate", CA_PATH)));

        // execution
        initializer.run(null);

        // verifications
        verify(integratedToolAgentService).updateConfigurationFields(configurationCaptor.capture());
        assertThat(configurationCaptor.getValue().getRunCommandArgs()).isNull();
    }

    @Test
    void run_missingConfigurationFile_skipped() {
        // setup
        agentConfigurationProperties.setAgentConfigurations(List.of("agent-configurations/missing-agent.json"));

        // execution
        initializer.run(null);

        // verifications
        verify(integratedToolAgentService, never()).updateConfigurationFields(any(IntegratedToolAgentConfiguration.class));
    }

    @Test
    void run_noConfigurations_throwsIllegalState() {
        // setup
        agentConfigurationProperties.setAgentConfigurations(List.of());

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> initializer.run(null));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("No agent configuration found");
    }
}
