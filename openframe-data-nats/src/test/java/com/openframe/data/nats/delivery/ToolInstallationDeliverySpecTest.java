package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.nats.mapper.DownloadConfigurationMapper;
import com.openframe.data.nats.mapper.LocalFilenameConfigurationMapper;
import com.openframe.data.nats.model.ToolInstallationMessage;
import com.openframe.delivery.spec.DeliveryRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ToolInstallationDeliverySpecTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String TOOL_AGENT_KEY = "tactical-agent";
    private static final String TOOL_ID = "tactical";
    private static final String TOOL_TYPE = "TACTICAL";
    private static final String VERSION = "1.2.3";
    private static final List<String> INSTALL_ARGS = List.of("--silent");

    @Mock private DownloadConfigurationMapper downloadConfigurationMapper;
    @Mock private LocalFilenameConfigurationMapper localFilenameConfigurationMapper;

    @InjectMocks private ToolInstallationDeliverySpec spec;

    private IntegratedToolAgent toolAgent;
    private IntegratedTool tool;

    @BeforeEach
    void setUp() {
        toolAgent = new IntegratedToolAgent();
        toolAgent.setKey(TOOL_AGENT_KEY);
        toolAgent.setToolId(TOOL_ID);
        toolAgent.setVersion(VERSION);
        toolAgent.setInstallationCommandArgs(INSTALL_ARGS);
        tool = new IntegratedTool();
        tool.setToolType(TOOL_TYPE);
    }

    @Test
    void request_toolAgent_messageBuiltAndTargetIsAgentKey() {
        // setup
        when(downloadConfigurationMapper.map(null, VERSION)).thenReturn(List.of());
        ToolInstallationDeliverySeed seed = new ToolInstallationDeliverySeed(MACHINE_ID, toolAgent, tool, true);

        // execution
        DeliveryRequest<ToolInstallationMessage> request = spec.request(seed);

        // verifications
        assertThat(request.getType()).isEqualTo(DeliveryType.TOOL_INSTALLATION);
        assertThat(request.getTargetId()).isEqualTo(TOOL_AGENT_KEY);
        assertThat(request.getMachineId()).isEqualTo(MACHINE_ID);
        ToolInstallationMessage message = request.getPayload();
        assertThat(message.getToolAgentId()).isEqualTo(TOOL_AGENT_KEY);
        assertThat(message.getToolId()).isEqualTo(TOOL_ID);
        assertThat(message.getToolType()).isEqualTo(TOOL_TYPE);
        assertThat(message.getVersion()).isEqualTo(VERSION);
        assertThat(message.getInstallationCommandArgs()).isEqualTo(INSTALL_ARGS);
        assertThat(message.isReinstall()).isTrue();
    }

    @Test
    void request_toolWithoutIdAndType_emptyStringsNotNulls() {
        // setup
        toolAgent.setToolId(null);
        tool.setToolType(null);
        when(downloadConfigurationMapper.map(null, VERSION)).thenReturn(List.of());
        ToolInstallationDeliverySeed seed = new ToolInstallationDeliverySeed(MACHINE_ID, toolAgent, tool, false);

        // execution
        DeliveryRequest<ToolInstallationMessage> request = spec.request(seed);

        // verifications
        assertThat(request.getPayload().getToolId()).isEmpty();
        assertThat(request.getPayload().getToolType()).isEmpty();
    }

    @Test
    void subject_machineId_machineToolInstallationSubject() {
        // execution
        String subject = spec.subject(MACHINE_ID);

        // verifications
        assertThat(subject).isEqualTo("machine.mach-42.tool-installation");
    }
}
