package com.openframe.data.service;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.ToolAgentAsset;
import com.openframe.data.document.toolagent.ToolAgentAssetSource;
import com.openframe.data.mapper.DownloadConfigurationMapper;
import com.openframe.data.model.nats.ToolInstallationMessage;
import com.openframe.data.repository.nats.NatsMessagePublisher;
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

    public void publish(String machineId, IntegratedToolAgent toolAgent, IntegratedTool tool) {
        publish(machineId, toolAgent, tool, false);
    }

    public void publish(String machineId, IntegratedToolAgent toolAgent, IntegratedTool tool, boolean reinstall) {
        String topicName = buildTopicName(machineId);
        ToolInstallationMessage message = buildMessage(toolAgent, tool, reinstall);
        natsMessagePublisher.publish(topicName, message);
    }

    private String buildTopicName(String machineId) {
        return format(TOPIC_NAME_TEMPLATE, machineId);
    }

    private ToolInstallationMessage buildMessage(IntegratedToolAgent toolAgent, IntegratedTool tool) {
        return buildMessage(toolAgent, tool, false);
    }

    private ToolInstallationMessage buildMessage(IntegratedToolAgent toolAgent, IntegratedTool tool, boolean reinstall) {
        ToolInstallationMessage message = new ToolInstallationMessage();
        message.setToolAgentId(toolAgent.getId());
        // TODO: need refactoring
        message.setToolId(toolAgent.getToolId() == null ? "" : toolAgent.getToolId());
        message.setToolType(tool.getToolType() == null ? "" : tool.getToolType() );

        String version = toolAgent.getVersion();
        message.setVersion(version);
        message.setSessionType(toolAgent.getSessionType());
        message.setDownloadConfigurations(downloadConfigurationMapper.map(toolAgent.getDownloadConfigurations(), version));
        message.setAssets(mapAssets(toolAgent.getAssets(), version));
        message.setInstallationCommandArgs(toolAgent.getInstallationCommandArgs());
        message.setUninstallationCommandArgs(toolAgent.getUninstallationCommandArgs());
        message.setRunCommandArgs(toolAgent.getRunCommandArgs());
        message.setToolAgentIdCommandArgs(toolAgent.getAgentToolIdCommandArgs());
        message.setReinstall(reinstall);
        return message;
    }

    private List<ToolInstallationMessage.Asset> mapAssets(List<ToolAgentAsset> assets, String version) {
        if (assets == null) {
            return null;
        }
        return assets.stream()
                .map(asset -> mapAsset(asset, version))
                .collect(Collectors.toList());
    }

    private ToolInstallationMessage.Asset mapAsset(ToolAgentAsset asset, String version) {
        ToolInstallationMessage.Asset messageAsset = new ToolInstallationMessage.Asset();
        messageAsset.setId(asset.getId());
        messageAsset.setLocalFilename(asset.getLocalFilename());
        messageAsset.setSource(mapAssetSource(asset.getSource()));
        messageAsset.setPath(asset.getPath());
        messageAsset.setExecutable(asset.isExecutable());
        messageAsset.setVersion(asset.getVersion());

        String assetVersion = asset.getVersion();
        messageAsset.setDownloadConfigurations(
                downloadConfigurationMapper.map(asset.getDownloadConfigurations(), assetVersion));
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
