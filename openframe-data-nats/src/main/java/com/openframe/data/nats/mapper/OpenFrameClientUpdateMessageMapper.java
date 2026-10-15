package com.openframe.data.nats.mapper;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.nats.model.OpenFrameClientUpdateMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class OpenFrameClientUpdateMessageMapper {

    private final DownloadConfigurationMapper downloadConfigurationMapper;

    public OpenFrameClientUpdateMessage toMessage(OpenFrameClientConfiguration configuration) {
        String version = configuration.getVersion();
        List<DownloadConfiguration> downloadConfiguration = configuration.getDownloadConfiguration();
        OpenFrameClientUpdateMessage message = new OpenFrameClientUpdateMessage();
        message.setVersion(version);
        message.setDownloadConfigurations(downloadConfigurationMapper.map(downloadConfiguration, version));
        return message;
    }
}
