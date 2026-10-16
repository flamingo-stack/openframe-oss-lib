package com.openframe.data.nats.mapper;

import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.ToolAgentAsset;
import com.openframe.data.nats.model.DownloadConfiguration;
import com.openframe.data.nats.model.ToolAgentUpdateMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ToolAgentUpdateMessageMapperTest {

    private static final String TOOL_AGENT_KEY = "fleetmdm-agent";
    private static final String VERSION = "1.2.3";
    private static final String ASSET_ID = "osqueryd";
    private static final String ASSET_VERSION = "5.0.1";

    @Mock private DownloadConfigurationMapper downloadConfigurationMapper;
    @InjectMocks private ToolAgentUpdateMessageMapper mapper;

    @Test
    void toMessage_toolAgentWithAnAsset_versionsAndDownloadsResolvedPerVersion() {
        // setup
        List<com.openframe.data.document.clientconfiguration.DownloadConfiguration> agentDownloads = new ArrayList<>();
        List<com.openframe.data.document.clientconfiguration.DownloadConfiguration> assetDownloads = new ArrayList<>();
        ToolAgentAsset asset = new ToolAgentAsset();
        asset.setId(ASSET_ID);
        asset.setVersion(ASSET_VERSION);
        asset.setExecutable(true);
        asset.setDownloadConfigurations(assetDownloads);
        IntegratedToolAgent toolAgent = new IntegratedToolAgent();
        toolAgent.setKey(TOOL_AGENT_KEY);
        toolAgent.setVersion(VERSION);
        toolAgent.setDownloadConfigurations(agentDownloads);
        toolAgent.setAssets(List.of(asset));
        List<DownloadConfiguration> agentResolved = List.of(new DownloadConfiguration());
        List<DownloadConfiguration> assetResolved = List.of(new DownloadConfiguration());
        when(downloadConfigurationMapper.map(agentDownloads, VERSION)).thenReturn(agentResolved);
        when(downloadConfigurationMapper.map(assetDownloads, ASSET_VERSION)).thenReturn(assetResolved);

        // execution
        ToolAgentUpdateMessage message = mapper.toMessage(toolAgent);

        // verifications
        assertThat(message.getToolAgentId()).isEqualTo(TOOL_AGENT_KEY);
        assertThat(message.getVersion()).isEqualTo(VERSION);
        assertThat(message.getDownloadConfigurations()).isSameAs(agentResolved);
        assertThat(message.getDelivery()).isNull();
        assertThat(message.getAssets()).hasSize(1);
        ToolAgentUpdateMessage.AssetUpdate assetUpdate = message.getAssets().get(0);
        assertThat(assetUpdate.getAssetId()).isEqualTo(ASSET_ID);
        assertThat(assetUpdate.getVersion()).isEqualTo(ASSET_VERSION);
        assertThat(assetUpdate.isExecutable()).isTrue();
        assertThat(assetUpdate.getDownloadConfigurations()).isSameAs(assetResolved);
    }

    @Test
    void toMessage_toolAgentWithoutAssets_noAssetList() {
        // setup
        IntegratedToolAgent toolAgent = new IntegratedToolAgent();
        toolAgent.setKey(TOOL_AGENT_KEY);
        toolAgent.setVersion(VERSION);

        // execution
        ToolAgentUpdateMessage message = mapper.toMessage(toolAgent);

        // verifications
        assertThat(message.getAssets()).isNull();
    }
}
