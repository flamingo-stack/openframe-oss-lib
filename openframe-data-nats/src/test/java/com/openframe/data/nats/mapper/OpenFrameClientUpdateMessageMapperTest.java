package com.openframe.data.nats.mapper;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.nats.model.DownloadConfiguration;
import com.openframe.data.nats.model.OpenFrameClientUpdateMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OpenFrameClientUpdateMessageMapperTest {

    private static final String VERSION = "1.5.40";

    @Mock private DownloadConfigurationMapper downloadConfigurationMapper;

    @Test
    void toMessage_configuration_versionAndDownloadsResolvedForThatVersion() {
        // setup
        OpenFrameClientUpdateMessageMapper mapper = new OpenFrameClientUpdateMessageMapper(downloadConfigurationMapper);
        List<com.openframe.data.document.clientconfiguration.DownloadConfiguration> stored = List.of();
        OpenFrameClientConfiguration configuration = OpenFrameClientConfiguration.builder()
                .version(VERSION)
                .downloadConfiguration(stored)
                .build();
        List<DownloadConfiguration> resolved = List.of(new DownloadConfiguration());
        when(downloadConfigurationMapper.map(stored, VERSION)).thenReturn(resolved);

        // execution
        OpenFrameClientUpdateMessage message = mapper.toMessage(configuration);

        // verifications
        assertThat(message.getVersion()).isEqualTo(VERSION);
        assertThat(message.getDownloadConfigurations()).isSameAs(resolved);
        assertThat(message.getDelivery()).isNull();
    }
}
