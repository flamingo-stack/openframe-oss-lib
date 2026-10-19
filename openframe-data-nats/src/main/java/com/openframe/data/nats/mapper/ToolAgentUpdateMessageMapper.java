package com.openframe.data.nats.mapper;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.ToolAgentAsset;
import com.openframe.data.nats.model.ToolAgentUpdateMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class ToolAgentUpdateMessageMapper {

    private final DownloadConfigurationMapper downloadConfigurationMapper;

    public ToolAgentUpdateMessage toMessage(IntegratedToolAgent toolAgent) {
        String toolAgentVersion = toolAgent.getVersion();
        List<DownloadConfiguration> downloadConfigurations = toolAgent.getDownloadConfigurations();
        ToolAgentUpdateMessage message = new ToolAgentUpdateMessage();
        message.setToolAgentId(toolAgent.getKey());
        message.setVersion(toolAgentVersion);
        message.setSessionType(toolAgent.getSessionType());
        message.setDownloadConfigurations(downloadConfigurationMapper.map(downloadConfigurations, toolAgentVersion));
        message.setAssets(mapAssets(toolAgent.getAssets()));
        return message;
    }

    private List<ToolAgentUpdateMessage.AssetUpdate> mapAssets(List<ToolAgentAsset> assets) {
        if (assets == null) {
            return List.of();
        }
        return assets.stream()
                .map(this::mapAsset)
                .toList();
    }

    private ToolAgentUpdateMessage.AssetUpdate mapAsset(ToolAgentAsset asset) {
        String assetVersion = asset.getVersion();
        ToolAgentUpdateMessage.AssetUpdate assetUpdate = new ToolAgentUpdateMessage.AssetUpdate();
        assetUpdate.setAssetId(asset.getId());
        assetUpdate.setVersion(assetVersion);
        assetUpdate.setExecutable(asset.isExecutable());
        assetUpdate.setDownloadConfigurations(downloadConfigurationMapper.map(asset.getDownloadConfigurations(), assetVersion));
        return assetUpdate;
    }
}
