package com.openframe.data.service;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.ToolAgentAsset;
import com.openframe.data.document.toolagent.ToolAgentAssetSource;
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

    public void publish(String machineId, IntegratedToolAgent toolAgent, IntegratedTool tool) {
        String topicName = buildTopicName(machineId);
        ToolInstallationMessage message = buildMessage(toolAgent, tool);
        natsMessagePublisher.publish(topicName, message);
    }

    private String buildTopicName(String machineId) {
        return format(TOPIC_NAME_TEMPLATE, machineId);
    }

    private ToolInstallationMessage buildMessage(IntegratedToolAgent toolAgent, IntegratedTool tool) {
        ToolInstallationMessage message = new ToolInstallationMessage();
        message.setToolAgentId(toolAgent.getId());
        // TODO: need refactoring
        message.setToolId(toolAgent.getToolId() == null ? "" : toolAgent.getToolId());
        message.setToolType(tool.getToolType() == null ? "" : tool.getToolType() );

        message.setVersion(toolAgent.getVersion());
        message.setSessionType(toolAgent.getSessionType());
        message.setDownloadConfigurations(mapDownloadConfigurations(toolAgent.getDownloadConfigurations()));
        message.setAssets(mapAssets(toolAgent.getAssets()));
        message.setInstallationCommandArgs(toolAgent.getInstallationCommandArgs());
        message.setUninstallationCommandArgs(toolAgent.getUninstallationCommandArgs());
        message.setRunCommandArgs(toolAgent.getRunCommandArgs());
        message.setToolAgentIdCommandArgs(toolAgent.getAgentToolIdCommandArgs());
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
        messageAsset.setId(asset.getId());
        messageAsset.setLocalFilename(asset.getLocalFilename());
        messageAsset.setSource(mapAssetSource(asset.getSource()));
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
        };
    }

    private List<com.openframe.data.model.nats.DownloadConfiguration> mapDownloadConfigurations(
            List<com.openframe.data.document.clientconfiguration.DownloadConfiguration> downloadConfigurations) {
        if (downloadConfigurations == null) {
            return null;
        }
        return downloadConfigurations.stream()
                .map(this::mapDownloadConfiguration)
                .collect(Collectors.toList());
    }

    private com.openframe.data.model.nats.DownloadConfiguration mapDownloadConfiguration(
            com.openframe.data.document.clientconfiguration.DownloadConfiguration downloadConfiguration) {
        com.openframe.data.model.nats.DownloadConfiguration messageDownloadConfig = 
                new com.openframe.data.model.nats.DownloadConfiguration();
        messageDownloadConfig.setOs(downloadConfiguration.getOs());
        messageDownloadConfig.setLinkTemplate(downloadConfiguration.getLinkTemplate());
        messageDownloadConfig.setFileName(downloadConfiguration.getFileName());
        messageDownloadConfig.setAgentFileName(downloadConfiguration.getAgentFileName());
        return messageDownloadConfig;
    }

}
