package com.openframe.data.nats.publisher;

import com.openframe.data.document.toolagent.IntegratedToolAgent;
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
        if (!toolAgentUpdateFeatureEnabled) {
            log.info("Tool agent update publishing is disabled, skipping publish for tool: {} version: {}",
                    toolAgent.getId(), toolAgent.getVersion());
            return;
        }

        String toolAgentId = toolAgent.getId();

        integratedToolAgentService.markAsNonPublished(toolAgentId);

        try {
            String topicName = buildTopicName(toolAgent);
            ToolAgentUpdateMessage message = buildMessage(toolAgent);
            natsMessagePublisher.publishPersistent(topicName, message);
        } catch (Exception e) {
            log.error("NATS publish failed for tool agent {}, will be retried by scheduler", toolAgentId, e);
            return;
        }

        try {
            integratedToolAgentService.markAsPublished(toolAgentId);
            log.info("Published tool update message for tool: {} version: {}", toolAgentId, toolAgent.getVersion());
        } catch (OptimisticLockingFailureException e) {
            log.warn("Concurrent writer for tool agent {} during publish; skipping mark-published", toolAgentId);
        }
    }

    private String buildTopicName(IntegratedToolAgent toolAgent) {
        String toolAgentId = toolAgent.getId();
        return format(TOPIC_NAME_TEMPLATE, toolAgentId);
    }

    private ToolAgentUpdateMessage buildMessage(IntegratedToolAgent toolAgent) {
        ToolAgentUpdateMessage message = new ToolAgentUpdateMessage();
        message.setToolAgentId(toolAgent.getId());
        message.setVersion(toolAgent.getVersion());
        message.setSessionType(toolAgent.getSessionType());
        message.setDownloadConfigurations(
                downloadConfigurationMapper.map(toolAgent.getDownloadConfigurations(), toolAgent.getVersion())
        );
        message.setAssets(mapAssets(toolAgent.getAssets()));
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
        ToolAgentUpdateMessage.AssetUpdate assetUpdate = new ToolAgentUpdateMessage.AssetUpdate();
        assetUpdate.setAssetId(asset.getId());
        assetUpdate.setVersion(asset.getVersion());
        assetUpdate.setExecutable(asset.isExecutable());
        assetUpdate.setDownloadConfigurations(
                downloadConfigurationMapper.map(asset.getDownloadConfigurations(), asset.getVersion())
        );
        return assetUpdate;
    }
}
