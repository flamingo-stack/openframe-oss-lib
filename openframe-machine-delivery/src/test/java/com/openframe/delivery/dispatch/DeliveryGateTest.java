package com.openframe.delivery.dispatch;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.installedagents.InstalledAgent;
import com.openframe.data.repository.installedagents.InstalledAgentRepository;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.config.DeliveryTestPolicies;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryGateTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String CLIENT_AGENT_TYPE = "openframe-client";
    private static final String MIN_VERSION = "1.4.0";

    @Mock private InstalledAgentRepository installedAgentRepository;

    private DeliveryGate gate;

    private DeliveryProperties properties;
    private InstalledAgent client;

    @BeforeEach
    void setUp() {
        properties = DeliveryTestPolicies.properties();
        properties.setEnabled(Map.of(DeliveryType.TOOL_INSTALLATION, true));
        properties.setMinAgentVersion(Map.of(DeliveryType.TOOL_INSTALLATION, MIN_VERSION));
        client = new InstalledAgent();
        client.setMachineId(MACHINE_ID);
        client.setAgentType(CLIENT_AGENT_TYPE);
        gate = new DeliveryGate(properties, installedAgentRepository);
    }

    @Test
    void isOpen_typeOff_falseWithoutLookup() {
        // setup
        properties.setEnabled(Map.of());

        // execution
        boolean open = gate.isOpen(DeliveryType.TOOL_INSTALLATION, MACHINE_ID);

        // verifications
        assertThat(open).isFalse();
        verifyNoInteractions(installedAgentRepository);
    }

    @Test
    void isOpen_typeOnWithoutMinAgentVersion_falseWithoutLookup() {
        // setup
        properties.setMinAgentVersion(Map.of());

        // execution
        boolean open = gate.isOpen(DeliveryType.TOOL_INSTALLATION, MACHINE_ID);

        // verifications
        assertThat(open).isFalse();
        verifyNoInteractions(installedAgentRepository);
    }

    @Test
    void isOpen_clientAgentRowMissing_false() {
        // setup
        when(installedAgentRepository.findByMachineIdAndAgentType(MACHINE_ID, CLIENT_AGENT_TYPE)).thenReturn(Optional.empty());

        // execution
        boolean open = gate.isOpen(DeliveryType.TOOL_INSTALLATION, MACHINE_ID);

        // verifications
        assertThat(open).isFalse();
    }

    @Test
    void isOpen_clientAgentVersionBlank_false() {
        // setup
        client.setVersion(" ");
        when(installedAgentRepository.findByMachineIdAndAgentType(MACHINE_ID, CLIENT_AGENT_TYPE)).thenReturn(Optional.of(client));

        // execution
        boolean open = gate.isOpen(DeliveryType.TOOL_INSTALLATION, MACHINE_ID);

        // verifications
        assertThat(open).isFalse();
    }

    @Test
    void isOpen_clientAgentBelowMinimum_false() {
        // setup
        client.setVersion("1.3.9");
        when(installedAgentRepository.findByMachineIdAndAgentType(MACHINE_ID, CLIENT_AGENT_TYPE)).thenReturn(Optional.of(client));

        // execution
        boolean open = gate.isOpen(DeliveryType.TOOL_INSTALLATION, MACHINE_ID);

        // verifications
        assertThat(open).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"1.4.0", "1.4.1", "1.10.0", "2.0.0"})
    void isOpen_clientAgentAtOrAboveMinimum_true(String version) {
        // setup
        client.setVersion(version);
        when(installedAgentRepository.findByMachineIdAndAgentType(MACHINE_ID, CLIENT_AGENT_TYPE)).thenReturn(Optional.of(client));

        // execution
        boolean open = gate.isOpen(DeliveryType.TOOL_INSTALLATION, MACHINE_ID);

        // verifications
        assertThat(open).isTrue();
    }
}
