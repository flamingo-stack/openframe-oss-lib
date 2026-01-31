package com.openframe.data.mapper;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class LocalFilenameConfigurationMapper {

    public List<com.openframe.data.model.nats.ToolInstallationMessage.LocalFilenameConfiguration> map(
            List<com.openframe.data.document.toolagent.LocalFilenameConfiguration> localFilenameConfigurations
    ) {
        if (localFilenameConfigurations == null) {
            return null;
        }
        return localFilenameConfigurations.stream()
                .map(this::mapToNatsLocalFilenameConfiguration)
                .collect(Collectors.toList());
    }

    private com.openframe.data.model.nats.ToolInstallationMessage.LocalFilenameConfiguration mapToNatsLocalFilenameConfiguration(
            com.openframe.data.document.toolagent.LocalFilenameConfiguration localFilenameConfiguration
    ) {
        com.openframe.data.model.nats.ToolInstallationMessage.LocalFilenameConfiguration eventConfig =
                new com.openframe.data.model.nats.ToolInstallationMessage.LocalFilenameConfiguration();
        eventConfig.setFilename(localFilenameConfiguration.getFilename());
        eventConfig.setOs(localFilenameConfiguration.getOs());
        
        return eventConfig;
    }
}
