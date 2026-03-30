package com.openframe.data.nats.publisher;

import com.openframe.data.document.clientconfiguration.PublishState;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.ToolAgentAsset;
import com.openframe.data.nats.mapper.DownloadConfigurationMapper;
import com.openframe.data.nats.model.AssetUpdate;
import com.openframe.data.nats.model.ToolAgentUpdateMessage;
import com.openframe.data.service.IntegratedToolAgentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

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
            log.info("Tool agent update publishing is disabled, skipping publish for tool: {} version: {}", toolAgent.getId(), toolAgent.getVersion());
            return;
        }

        String toolAgentId = toolAgent.getId();
        markAsNonPublished(toolAgentId);

        String topicName = buildTopicName(toolAgent);
        ToolAgentUpdateMessage message = buildMessage(toolAgent);
        natsMessagePublisher.publishPersistent(topicName, message);

        markAsPublished(toolAgentId);

        log.info("Published tool update message for tool: {} version: {}", toolAgent.getId(), toolAgent.getVersion());
    }

    private void markAsNonPublished(String toolAgentId) {
        IntegratedToolAgent toolAgent = integratedToolAgentService.getById(toolAgentId);

        PublishState publishState = toolAgent.getPublishState();
        PublishState stateBefore = PublishState.nonPublished(publishState);
        toolAgent.setPublishState(stateBefore);

        integratedToolAgentService.save(toolAgent);
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
        return message;
    }

    private ToolAgentUpdateMessage buildMessage(IntegratedToolAgent toolAgent, ToolAgentAsset asset) {
        ToolAgentUpdateMessage message = buildMessage(toolAgent);
        message.setAsset(buildAssetUpdate(asset));
        return message;
    }

    private AssetUpdate buildAssetUpdate(ToolAgentAsset asset) {
        AssetUpdate assetUpdate = new AssetUpdate();
        assetUpdate.setAssetId(asset.getId());
        assetUpdate.setVersion(asset.getVersion());
        assetUpdate.setExecutable(asset.isExecutable());
        assetUpdate.setDownloadConfigurations(
                downloadConfigurationMapper.map(asset.getDownloadConfigurations(), asset.getVersion())
        );
        return assetUpdate;
    }

    public void publishAssetUpdate(String toolAgentId, String assetId) {
        if (!toolAgentUpdateFeatureEnabled) {
            log.info("Tool agent update publishing is disabled, skipping asset update for tool: {} asset: {}", toolAgentId, assetId);
            return;
        }

        IntegratedToolAgent toolAgent = integratedToolAgentService.getById(toolAgentId);
        if (toolAgent == null) {
            log.warn("Tool agent not found: {}", toolAgentId);
            return;
        }

        ToolAgentAsset asset = toolAgent.getAssets().stream()
                .filter(a -> a.getId().equals(assetId))
                .findFirst()
                .orElse(null);

        if (asset == null) {
            log.warn("Asset not found: {} for tool: {}", assetId, toolAgentId);
            return;
        }

        String topicName = buildTopicName(toolAgent);
        ToolAgentUpdateMessage message = buildMessage(toolAgent, asset);
        natsMessagePublisher.publishPersistent(topicName, message);

        log.info("Published asset update message for tool: {} asset: {} version: {}", toolAgentId, assetId, asset.getVersion());
    }

    private void markAsPublished(String toolAgentId) {
        IntegratedToolAgent toolAgent = integratedToolAgentService.getById(toolAgentId);

        PublishState publishState = toolAgent.getPublishState();
        toolAgent.setPublishState(PublishState.published(publishState));
        integratedToolAgentService.save(toolAgent);
    }
}

