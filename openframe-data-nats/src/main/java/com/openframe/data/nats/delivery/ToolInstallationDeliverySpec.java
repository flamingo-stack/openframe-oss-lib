package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.ToolAgentAsset;
import com.openframe.data.document.toolagent.ToolAgentAssetSource;
import com.openframe.data.nats.mapper.DownloadConfigurationMapper;
import com.openframe.data.nats.mapper.LocalFilenameConfigurationMapper;
import com.openframe.data.nats.model.ToolInstallationMessage;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.DeliverySpec;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;

import static java.lang.String.format;
import static java.util.Objects.requireNonNullElse;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class ToolInstallationDeliverySpec implements DeliverySpec<ToolInstallationDeliverySeed, ToolInstallationMessage> {

    private static final String SUBJECT_TEMPLATE = "machine.%s.tool-installation";

    private final DownloadConfigurationMapper downloadConfigurationMapper;
    private final LocalFilenameConfigurationMapper localFilenameConfigurationMapper;

    @Override
    public DeliveryType getType() {
        return DeliveryType.TOOL_INSTALLATION;
    }

    @Override
    public Class<ToolInstallationMessage> getPayloadClass() {
        return ToolInstallationMessage.class;
    }

    // targetId must equal the agentType the agent sends in installed-agent, or complete() never finds the row
    @Override
    public DeliveryRequest<ToolInstallationMessage> request(ToolInstallationDeliverySeed seed) {
        IntegratedToolAgent toolAgent = seed.getToolAgent();
        ToolInstallationMessage message = buildMessage(toolAgent, seed.getTool(), seed.isReinstall());
        String targetId = toolAgent.getKey();
        return DeliveryRequest.<ToolInstallationMessage>builder()
                .type(DeliveryType.TOOL_INSTALLATION)
                .targetId(targetId)
                .machineId(seed.getMachineId())
                .payload(message)
                .build();
    }

    @Override
    public String subject(String machineId) {
        return format(SUBJECT_TEMPLATE, machineId);
    }

    @Override
    public void onFailed(MachineDelivery delivery, DeliveryFailure failure) {
        // intentionally empty: a failed install leaves nothing to compensate
    }

    private ToolInstallationMessage buildMessage(IntegratedToolAgent toolAgent, IntegratedTool tool, boolean reinstall) {
        String version = toolAgent.getVersion();
        ToolInstallationMessage message = new ToolInstallationMessage();
        message.setToolAgentId(toolAgent.getKey());
        message.setToolId(requireNonNullElse(toolAgent.getToolId(), ""));
        message.setToolType(requireNonNullElse(tool.getToolType(), ""));
        message.setVersion(version);
        message.setSessionType(toolAgent.getSessionType());
        message.setDownloadConfigurations(downloadConfigurationMapper.map(toolAgent.getDownloadConfigurations(), version));
        message.setAssets(mapAssets(toolAgent.getAssets()));
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
                .toList();
    }

    private ToolInstallationMessage.Asset mapAsset(ToolAgentAsset asset) {
        String version = asset.getVersion();
        ToolInstallationMessage.Asset messageAsset = new ToolInstallationMessage.Asset();
        messageAsset.setId(asset.getId());
        messageAsset.setVersion(version);
        messageAsset.setLocalFilenameConfiguration(localFilenameConfigurationMapper.map(asset.getLocalFilenameConfiguration()));
        messageAsset.setDownloadConfigurations(downloadConfigurationMapper.map(asset.getDownloadConfigurations(), version));
        messageAsset.setSource(mapAssetSource(asset.getSource()));
        messageAsset.setPath(asset.getPath());
        messageAsset.setExecutable(asset.isExecutable());
        return messageAsset;
    }

    private static ToolInstallationMessage.AssetSource mapAssetSource(ToolAgentAssetSource source) {
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
