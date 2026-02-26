package com.openframe.data.nats.mapper;

import com.openframe.data.nats.model.DownloadConfiguration;
import com.openframe.data.nats.model.InstallationType;
import com.openframe.data.nats.resolver.DownloadConfigurationLinkResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class DownloadConfigurationMapper {

    private final DownloadConfigurationLinkResolver downloadConfigurationResolver;

    public List<DownloadConfiguration> map(
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

    private DownloadConfiguration mapToNatsDownloadConfiguration(
            com.openframe.data.document.clientconfiguration.DownloadConfiguration downloadConfiguration,
            String version
    ) {
        DownloadConfiguration natsDownloadConfig =
                new DownloadConfiguration();
        natsDownloadConfig.setOs(downloadConfiguration.getOs());
        natsDownloadConfig.setFileName(downloadConfiguration.getFileName());
        natsDownloadConfig.setTargetFileName(downloadConfiguration.getTargetFileName());
        natsDownloadConfig.setLink(downloadConfigurationResolver.resolve(downloadConfiguration, version));
        natsDownloadConfig.setInstallationType(mapInstallationType(downloadConfiguration.getInstallationType()));
        natsDownloadConfig.setBundleId(downloadConfiguration.getBundleId());

        return natsDownloadConfig;
    }

    private InstallationType mapInstallationType(
            com.openframe.data.document.clientconfiguration.InstallationType installationType
    ) {
        if (installationType == null) {
            return InstallationType.STANDARD;
        }
        return switch (installationType) {
            case GUI_APP -> InstallationType.GUI_APP;
            case STANDARD -> InstallationType.STANDARD;
        };
    }
}

