package com.openframe.data.nats.publisher;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.ToolAgentAsset;
import com.openframe.data.document.toolagent.ToolAgentAssetSource;
import com.openframe.data.nats.mapper.DownloadConfigurationMapper;
import com.openframe.data.nats.mapper.LocalFilenameConfigurationMapper;
import com.openframe.data.nats.model.ToolInstallationMessage;
import com.openframe.data.nats.publisher.NatsMessagePublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

import static java.lang.String.format;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
@Slf4j
public class ToolInstallationNatsPublisher {

    private final static String TOPIC_NAME_TEMPLATE = "machine.%s.tool-installation";

    private final NatsMessagePublisher natsMessagePublisher;
    private final DownloadConfigurationMapper downloadConfigurationMapper;
    private final LocalFilenameConfigurationMapper localFilenameConfigurationMapper;

    public void publish(String machineId, IntegratedToolAgent toolAgent, IntegratedTool tool) {
        publish(machineId, toolAgent, tool, false);
    }

    public void publish(String machineId, IntegratedToolAgent toolAgent, IntegratedTool tool, boolean reinstall) {
        String topicName = buildTopicName(machineId);
        ToolInstallationMessage message = buildMessage(toolAgent, tool, reinstall);
        natsMessagePublisher.publishPersistent(topicName, message);
    }

    private String buildTopicName(String machineId) {
        return format(TOPIC_NAME_TEMPLATE, machineId);
    }

    private ToolInstallationMessage buildMessage(IntegratedToolAgent toolAgent, IntegratedTool tool) {
        return buildMessage(toolAgent, tool, false);
    }

    private ToolInstallationMessage buildMessage(IntegratedToolAgent toolAgent, IntegratedTool tool, boolean reinstall) {
        ToolInstallationMessage message = new ToolInstallationMessage();
        String toolAgentKey = toolAgent.getKey();
        message.setToolAgentId(toolAgentKey);
        // TODO: need refactoring
        String toolId = toolAgent.getToolId();
        message.setToolId(toolId == null ? "" : toolId);
        String toolType = tool.getToolType();
        message.setToolType(toolType == null ? "" : toolType);

        String version = toolAgent.getVersion();
        message.setVersion(version);
        message.setSessionType(toolAgent.getSessionType());
        List<?> downloadConfigurations = toolAgent.getDownloadConfigurations();
        Object mappedDownloadConfigurations = downloadConfigurationMapper.map(downloadConfigurations, version);
        message.setDownloadConfigurations(mappedDownloadConfigurations);
        List<ToolAgentAsset> assets = toolAgent.getAssets();
        List<ToolInstallationMessage.Asset> mappedAssets = mapAssets(assets);
        message.setAssets(mappedAssets);
        message.setInstallationCommandArgs(toolAgent.getInstallationCommandArgs());
        message.setUninstallationCommandArgs(toolAgent.getUninstallationCommandArgs());
        message.setRunCommandArgs(toolAgent.getRunCommandArgs());
        message.setToolAgentIdCommandArgs(toolAgent.getAgentToolIdCommandArgs());
        message.setReinstall(reinstall);
        return message;
    }

    private List<ToolInstallationMessage.Asset> mapAssets(List<ToolAgentAsset> assets) {
        if (assets == null) {
            return null;
        }
        return assets.stream()
                .map(this::mapAsset)
                .collect(Collectors.toList());
    }

    private ToolInstallationMessage.Asset mapAsset(ToolAgentAsset asset) {
        ToolInstallationMessage.Asset messageAsset = new ToolInstallationMessage.Asset();
        String assetId = asset.getId();
        messageAsset.setId(assetId);
        String assetVersion = asset.getVersion();
        messageAsset.setVersion(assetVersion);
        Object localFilenameConfiguration = asset.getLocalFilenameConfiguration();
        Object mappedLocalFilenameConfiguration = localFilenameConfigurationMapper.map(localFilenameConfiguration);
        messageAsset.setLocalFilenameConfiguration(mappedLocalFilenameConfiguration);
        List<?> assetDownloadConfigurations = asset.getDownloadConfigurations();
        Object mappedAssetDownloadConfigurations = downloadConfigurationMapper.map(assetDownloadConfigurations, assetVersion);
        messageAsset.setDownloadConfigurations(mappedAssetDownloadConfigurations);
        ToolAgentAssetSource assetSource = asset.getSource();
        ToolInstallationMessage.AssetSource mappedAssetSource = mapAssetSource(assetSource);
        messageAsset.setSource(mappedAssetSource);
        messageAsset.setPath(asset.getPath());
        messageAsset.setExecutable(asset.isExecutable());
        return messageAsset;
    }

    private ToolInstallationMessage.AssetSource mapAssetSource(ToolAgentAssetSource source) {
        if (source == null) {
            return null;
        }
        return switch (source) {
            case ARTIFACTORY -> ToolInstallationMessage.AssetSource.ARTIFACTORY;
            case TOOL_API -> ToolInstallationMessage.AssetSource.TOOL_API;
            case GITHUB -> ToolInstallationMessage.AssetSource.GITHUB;
        };
    }

}
