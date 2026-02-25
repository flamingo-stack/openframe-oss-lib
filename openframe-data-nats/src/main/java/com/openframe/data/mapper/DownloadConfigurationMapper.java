package com.openframe.data.mapper;

import com.openframe.data.resolver.DownloadConfigurationLinkResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class DownloadConfigurationMapper {

    private final DownloadConfigurationLinkResolver downloadConfigurationResolver;

    public List<com.openframe.data.model.nats.DownloadConfiguration> map(
            List<com.openframe.data.document.clientconfiguration.DownloadConfiguration> downloadConfigurations,
            String version
    ) {
        if (downloadConfigurations == null) {
            return null;
        }
        return downloadConfigurations.stream()
                .map(config -> mapToNatsDownloadConfiguration(config, version))
                .collect(Collectors.toList());
    }

    private com.openframe.data.model.nats.DownloadConfiguration mapToNatsDownloadConfiguration(
            com.openframe.data.document.clientconfiguration.DownloadConfiguration downloadConfiguration,
            String version
    ) {
        com.openframe.data.model.nats.DownloadConfiguration natsDownloadConfig =
                new com.openframe.data.model.nats.DownloadConfiguration();
        natsDownloadConfig.setOs(downloadConfiguration.getOs());
        natsDownloadConfig.setFileName(downloadConfiguration.getFileName());
        natsDownloadConfig.setTargetFileName(downloadConfiguration.getTargetFileName());
        natsDownloadConfig.setLink(downloadConfigurationResolver.resolve(downloadConfiguration, version));
        natsDownloadConfig.setInstallationType(mapInstallationType(downloadConfiguration.getInstallationType()));
        natsDownloadConfig.setBundleId(downloadConfiguration.getBundleId());

        return natsDownloadConfig;
    }

    private com.openframe.data.model.nats.InstallationType mapInstallationType(
            com.openframe.data.document.clientconfiguration.InstallationType installationType
    ) {
        if (installationType == null) {
            return com.openframe.data.model.nats.InstallationType.STANDARD;
        }
        return switch (installationType) {
            case GUI_APP -> com.openframe.data.model.nats.InstallationType.GUI_APP;
            case STANDARD -> com.openframe.data.model.nats.InstallationType.STANDARD;
        };
    }
}

