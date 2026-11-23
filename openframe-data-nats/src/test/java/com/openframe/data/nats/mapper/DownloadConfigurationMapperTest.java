package com.openframe.data.nats.mapper;

import com.openframe.data.nats.model.DownloadConfiguration;
import com.openframe.data.nats.resolver.DownloadConfigurationLinkResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DownloadConfigurationMapperTest {

    private static final String VERSION = "4.60.0";
    private static final String WINDOWS_LINK = "https://downloads.example/fleet-windows.zip";
    private static final String MACOS_LINK = "https://downloads.example/fleet-macos.tar.gz";

    @Mock private DownloadConfigurationLinkResolver linkResolver;

    @InjectMocks private DownloadConfigurationMapper mapper;

    private com.openframe.data.document.clientconfiguration.DownloadConfiguration windows;
    private com.openframe.data.document.clientconfiguration.DownloadConfiguration macos;
    private JsonMapper jsonMapper;

    @BeforeEach
    void setUp() {
        windows = com.openframe.data.document.clientconfiguration.DownloadConfiguration.builder()
                .os("windows")
                .build();
        macos = com.openframe.data.document.clientconfiguration.DownloadConfiguration.builder()
                .os("macos")
                .minOsVersion("13.0")
                .build();
        jsonMapper = new JsonMapper();
    }

    @Test
    void map_configurationsWithAndWithoutMinimum_minOsVersionCarried() {
        // setup
        when(linkResolver.resolve(windows, VERSION)).thenReturn(WINDOWS_LINK);
        when(linkResolver.resolve(macos, VERSION)).thenReturn(MACOS_LINK);

        // execution
        List<DownloadConfiguration> mapped = mapper.map(List.of(windows, macos), VERSION);

        // verifications
        assertThat(mapped)
                .extracting(DownloadConfiguration::getOs, DownloadConfiguration::getLink, DownloadConfiguration::getMinOsVersion)
                .containsExactly(tuple("windows", WINDOWS_LINK, null), tuple("macos", MACOS_LINK, "13.0"));
    }

    @Test
    void map_configurationsNull_null() {
        // setup

        // execution
        List<DownloadConfiguration> mapped = mapper.map(null, VERSION);

        // verifications
        assertThat(mapped).isNull();
    }

    @Test
    void serialize_withoutMinimum_minOsVersionOmitted() {
        // setup
        when(linkResolver.resolve(windows, VERSION)).thenReturn(WINDOWS_LINK);
        List<DownloadConfiguration> mapped = mapper.map(List.of(windows), VERSION);

        // execution
        JsonNode json = jsonMapper.readTree(jsonMapper.writeValueAsString(mapped));

        // verifications
        assertThat(json.get(0).has("minOsVersion")).isFalse();
    }

    @Test
    void serialize_withMinimum_minOsVersionWritten() {
        // setup
        when(linkResolver.resolve(macos, VERSION)).thenReturn(MACOS_LINK);
        List<DownloadConfiguration> mapped = mapper.map(List.of(macos), VERSION);

        // execution
        JsonNode json = jsonMapper.readTree(jsonMapper.writeValueAsString(mapped));

        // verifications
        assertThat(json.get(0).get("minOsVersion").asText()).isEqualTo("13.0");
    }
}
