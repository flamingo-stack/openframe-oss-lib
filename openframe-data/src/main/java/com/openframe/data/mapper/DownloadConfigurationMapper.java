package com.openframe.data.mapper;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class DownloadConfigurationMapper {

    public List<com.openframe.data.model.nats.DownloadConfiguration> map(
            List<com.openframe.data.document.clientconfiguration.DownloadConfiguration> downloadConfigurations
    ) {
        if (downloadConfigurations == null) {
            return null;
        }
        return downloadConfigurations.stream()
                .map(this::mapToNatsDownloadConfiguration)
                .collect(Collectors.toList());
    }

    private com.openframe.data.model.nats.DownloadConfiguration mapToNatsDownloadConfiguration(
            com.openframe.data.document.clientconfiguration.DownloadConfiguration downloadConfiguration
    ) {
        com.openframe.data.model.nats.DownloadConfiguration natsDownloadConfig =
                new com.openframe.data.model.nats.DownloadConfiguration();
        natsDownloadConfig.setOs(downloadConfiguration.getOs());
        natsDownloadConfig.setLinkTemplate(downloadConfiguration.getLinkTemplate());
        natsDownloadConfig.setFileName(downloadConfiguration.getFileName());
        natsDownloadConfig.setAgentFileName(downloadConfiguration.getAgentFileName());
        return natsDownloadConfig;
    }
}

