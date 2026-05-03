package com.openframe.data.nats.publisher;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.SessionType;
import com.openframe.data.document.toolagent.ToolAgentAsset;
import com.openframe.data.nats.mapper.DownloadConfigurationMapper;
import com.openframe.data.nats.model.ToolAgentUpdateMessage;
import com.openframe.data.service.IntegratedToolAgentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

import static java.lang.String.format;

@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class ToolAgentUpdateUpdatePublisher {

    private final static String TOPIC_NAME_TEMPLATE = "machine.all.tool.%s.update";

    @Value("${openframe.tool-agent.update.feature.enabled:false}")
    private boolean toolAgentUpdateFeatureEnabled;

    private final NatsMessagePublisher natsMessagePublisher;
    private final DownloadConfigurationMapper downloadConfigurationMapper;
    private final IntegratedToolAgentService integratedToolAgentService;

    public void publish(IntegratedToolAgent toolAgent) {
        String toolAgentId = toolAgent.getId();
        String toolAgentVersion = toolAgent.getVersion();

        if (!toolAgentUpdateFeatureEnabled) {
            log.info("Tool agent update publishing is disabled, skipping publish for tool: {} version: {}",
                    toolAgentId, toolAgentVersion);
            return;
        }

        try {
            String topicName = buildTopicName(toolAgentId);
            ToolAgentUpdateMessage message = buildMessage(toolAgent);
            natsMessagePublisher.publishPersistent(topicName, message);
        } catch (Exception e) {
            log.error("NATS publish failed for tool agent {}, will be retried by scheduler", toolAgentId, e);
            try {
                integratedToolAgentService.markAsNonPublished(toolAgentId);
            } catch (OptimisticLockingFailureException ole) {
                log.warn("Concurrent writer for tool agent {} during failure-mark; skipping", toolAgentId);
            }
            return;
        }

        try {
            integratedToolAgentService.markAsPublished(toolAgentId);
            log.info("Published tool update message for tool: {} version: {}", toolAgentId, toolAgentVersion);
        } catch (OptimisticLockingFailureException e) {
            log.warn("Concurrent writer for tool agent {} during publish; skipping mark-published", toolAgentId);
        }
    }

    private String buildTopicName(String toolAgentId) {
        return format(TOPIC_NAME_TEMPLATE, toolAgentId);
    }

    private ToolAgentUpdateMessage buildMessage(IntegratedToolAgent toolAgent) {
        String toolAgentId = toolAgent.getId();
        String toolAgentVersion = toolAgent.getVersion();
        SessionType sessionType = toolAgent.getSessionType();
        List<DownloadConfiguration> downloadConfigurations = toolAgent.getDownloadConfigurations();
        List<ToolAgentAsset> assets = toolAgent.getAssets();

        ToolAgentUpdateMessage message = new ToolAgentUpdateMessage();
        message.setToolAgentId(toolAgentId);
        message.setVersion(toolAgentVersion);
        message.setSessionType(sessionType);
        message.setDownloadConfigurations(downloadConfigurationMapper.map(downloadConfigurations, toolAgentVersion));
        message.setAssets(mapAssets(assets));
        return message;
    }

    private List<ToolAgentUpdateMessage.AssetUpdate> mapAssets(List<ToolAgentAsset> assets) {
        if (assets == null) {
            return null;
        }
        return assets.stream()
                .map(this::mapAsset)
                .collect(Collectors.toList());
    }

    private ToolAgentUpdateMessage.AssetUpdate mapAsset(ToolAgentAsset asset) {
        String assetId = asset.getId();
        String assetVersion = asset.getVersion();
        boolean executable = asset.isExecutable();
        List<DownloadConfiguration> assetDownloadConfigurations = asset.getDownloadConfigurations();

        ToolAgentUpdateMessage.AssetUpdate assetUpdate = new ToolAgentUpdateMessage.AssetUpdate();
        assetUpdate.setAssetId(assetId);
        assetUpdate.setVersion(assetVersion);
        assetUpdate.setExecutable(executable);
        assetUpdate.setDownloadConfigurations(downloadConfigurationMapper.map(assetDownloadConfigurations, assetVersion));
        return assetUpdate;
    }
}
