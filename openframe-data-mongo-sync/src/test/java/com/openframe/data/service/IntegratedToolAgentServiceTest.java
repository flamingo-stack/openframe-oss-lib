package com.openframe.data.service;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.IntegratedToolAgentConfiguration;
import com.openframe.data.repository.toolagent.IntegratedToolAgentRepository;
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
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IntegratedToolAgentServiceTest {

    private static final String AGENT_KEY = "fleetmdm-agent";
    private static final String MACOS_MINIMUM = "13.0";

    @Mock private IntegratedToolAgentRepository agentRepository;

    @Captor private ArgumentCaptor<IntegratedToolAgent> agentCaptor;

    @InjectMocks private IntegratedToolAgentService service;

    private IntegratedToolAgentConfiguration configuration;
    private IntegratedToolAgent existing;

    @BeforeEach
    void setUp() {
        configuration = new IntegratedToolAgentConfiguration();
        configuration.setId(AGENT_KEY);
        configuration.setVersion("4.70.0");
        configuration.setDownloadConfigurations(List.of(
                downloadConfiguration("windows", null),
                downloadConfiguration("macos", MACOS_MINIMUM)));
        existing = new IntegratedToolAgent();
        existing.setId("agent-uuid");
        existing.setKey(AGENT_KEY);
        existing.setVersion("4.70.0");
        existing.setDownloadConfigurations(List.of(
                downloadConfiguration("windows", null),
                downloadConfiguration("macos", null)));
    }

    @Test
    void updateConfigurationFields_newAgent_minOsVersionKeptInDownloadConfigurations() {
        // setup
        when(agentRepository.findByKey(AGENT_KEY)).thenReturn(Optional.empty());

        // execution
        service.updateConfigurationFields(configuration);

        // verifications
        verify(agentRepository).save(agentCaptor.capture());
        assertThat(agentCaptor.getValue().getDownloadConfigurations())
                .extracting(DownloadConfiguration::getOs, DownloadConfiguration::getMinOsVersion)
                .containsExactly(tuple("windows", null), tuple("macos", MACOS_MINIMUM));
    }

    @Test
    void updateConfigurationFields_existingAgentWithoutMinimum_minOsVersionFromConfigurationSaved() {
        // setup
        when(agentRepository.findByKey(AGENT_KEY)).thenReturn(Optional.of(existing));

        // execution
        service.updateConfigurationFields(configuration);

        // verifications
        verify(agentRepository).save(agentCaptor.capture());
        assertThat(agentCaptor.getValue().getDownloadConfigurations())
                .extracting(DownloadConfiguration::getOs, DownloadConfiguration::getMinOsVersion)
                .containsExactly(tuple("windows", null), tuple("macos", MACOS_MINIMUM));
    }

    @Test
    void updateConfigurationFields_minimumDroppedFromConfiguration_minOsVersionClearedOnTheExistingAgent() {
        // setup
        existing.setDownloadConfigurations(List.of(downloadConfiguration("macos", MACOS_MINIMUM)));
        configuration.setDownloadConfigurations(List.of(downloadConfiguration("macos", null)));
        when(agentRepository.findByKey(AGENT_KEY)).thenReturn(Optional.of(existing));

        // execution
        service.updateConfigurationFields(configuration);

        // verifications
        verify(agentRepository).save(agentCaptor.capture());
        assertThat(agentCaptor.getValue().getDownloadConfigurations())
                .extracting(DownloadConfiguration::getOs, DownloadConfiguration::getMinOsVersion)
                .containsExactly(tuple("macos", null));
    }

    private static DownloadConfiguration downloadConfiguration(String os, String minOsVersion) {
        DownloadConfiguration configuration = new DownloadConfiguration();
        configuration.setOs(os);
        configuration.setMinOsVersion(minOsVersion);
        return configuration;
    }
}
