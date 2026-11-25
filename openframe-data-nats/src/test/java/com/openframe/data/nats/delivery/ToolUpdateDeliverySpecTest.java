package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.nats.mapper.ToolAgentUpdateMessageMapper;
import com.openframe.data.nats.model.DownloadConfiguration;
import com.openframe.data.nats.model.ToolAgentUpdateMessage;
import com.openframe.delivery.spec.DeliveryAudience;
import com.openframe.delivery.spec.DeliveryRequest;
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
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ToolUpdateDeliverySpecTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String TOOL_AGENT_KEY = "fleetmdm-agent";

    @Mock private ToolAgentUpdateMessageMapper messageMapper;
    @InjectMocks private ToolUpdateDeliverySpec spec;

    private IntegratedToolAgent toolAgent;
    private ToolAgentUpdateMessage message;
    private Machine machine;

    @BeforeEach
    void setUp() {
        toolAgent = new IntegratedToolAgent();
        toolAgent.setKey(TOOL_AGENT_KEY);
        toolAgent.setVersion("1.2.3");
        message = new ToolAgentUpdateMessage();
        message.setDownloadConfigurations(List.of(downloadConfiguration("windows", null),
                downloadConfiguration("macos", "13.0")));
        machine = new Machine();
        machine.setOsType(OsType.MAC_OS);
    }

    @Test
    void request_seedForOneMachine_requestToThatMachineForThatTool() {
        // setup
        when(messageMapper.toMessage(toolAgent)).thenReturn(message);
        ToolUpdateDeliverySeed seed = ToolUpdateDeliverySeed.forMachine(MACHINE_ID, toolAgent);

        // execution
        DeliveryRequest<ToolAgentUpdateMessage> request = spec.request(seed);

        // verifications
        assertThat(request.getType()).isEqualTo(DeliveryType.TOOL_UPDATE);
        assertThat(request.getTargetId()).isEqualTo(TOOL_AGENT_KEY);
        assertThat(request.getAudience()).isEqualTo(DeliveryAudience.MACHINE);
        assertThat(request.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(request.getPayload()).isSameAs(message);
        assertThat(request.getPayload().getDelivery()).isNull();
    }

    @Test
    void request_seedForEveryMachine_requestForEveryMachineWithoutAMachine() {
        // setup
        when(messageMapper.toMessage(toolAgent)).thenReturn(message);
        ToolUpdateDeliverySeed seed = ToolUpdateDeliverySeed.forEveryMachine(toolAgent);

        // execution
        DeliveryRequest<ToolAgentUpdateMessage> request = spec.request(seed);

        // verifications
        assertThat(request.isForEveryMachine()).isTrue();
        assertThat(request.getMachineId()).isNull();
        assertThat(request.getTargetId()).isEqualTo(TOOL_AGENT_KEY);
    }

    @Test
    void canDeliverToEveryMachine_toolUpdate_true() {
        // execution + verifications
        assertThat(spec.canDeliverToEveryMachine()).isTrue();
    }

    @Test
    void getDeliverableStatuses_default_machineBeingDeletedGetsNoUpdate() {
        // execution
        Set<DeviceStatus> statuses = spec.getDeliverableStatuses();

        // verifications
        assertThat(statuses).containsExactlyInAnyOrder(
                DeviceStatus.MANAGED, DeviceStatus.PENDING);
    }

    @Test
    void subject_machineId_oneToolUpdateSubjectPerMachine() {
        // execution
        String subject = spec.subject(MACHINE_ID);

        // verifications
        assertThat(subject).isEqualTo("machine.mach-42.tool-update.v2");
    }

    @Test
    void admits_macBelowMinimum_false() {
        // setup
        machine.setOsVersion("11.7.10");

        // execution
        boolean admitted = spec.admits(machine, message);

        // verifications
        assertThat(admitted).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"13.0", "13", "14.2"})
    void admits_macAtOrAboveMinimum_true(String osVersion) {
        // setup
        machine.setOsVersion(osVersion);

        // execution
        boolean admitted = spec.admits(machine, message);

        // verifications
        assertThat(admitted).isTrue();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "unknown"})
    void admits_macVersionUnknown_true(String osVersion) {
        // setup
        machine.setOsVersion(osVersion);

        // execution
        boolean admitted = spec.admits(machine, message);

        // verifications
        assertThat(admitted).isTrue();
    }

    @Test
    void admits_windowsMachine_true() {
        // setup
        machine.setOsType(OsType.WINDOWS);
        machine.setOsVersion("6.1");

        // execution
        boolean admitted = spec.admits(machine, message);

        // verifications
        assertThat(admitted).isTrue();
    }

    @Test
    void admits_osTypeUnknown_true() {
        // setup
        machine.setOsType(null);
        machine.setOsVersion("11.7.10");

        // execution
        boolean admitted = spec.admits(machine, message);

        // verifications
        assertThat(admitted).isTrue();
    }

    @Test
    void admits_payloadWithoutDownloadConfigurations_true() {
        // setup
        message.setDownloadConfigurations(null);
        machine.setOsVersion("11.7.10");

        // execution
        boolean admitted = spec.admits(machine, message);

        // verifications
        assertThat(admitted).isTrue();
    }

    @Test
    void admits_macosConfigurationWithoutMinimum_true() {
        // setup
        message.setDownloadConfigurations(List.of(downloadConfiguration("macos", null)));
        machine.setOsVersion("11.7.10");

        // execution
        boolean admitted = spec.admits(machine, message);

        // verifications
        assertThat(admitted).isTrue();
    }

    private static DownloadConfiguration downloadConfiguration(String os, String minOsVersion) {
        DownloadConfiguration configuration = new DownloadConfiguration();
        configuration.setOs(os);
        configuration.setMinOsVersion(minOsVersion);
        return configuration;
    }
}
