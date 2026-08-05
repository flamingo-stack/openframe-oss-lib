package com.openframe.data.nats.resolver;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DownloadConfigurationLinkResolverTest {

    private static final String GITHUB_TEMPLATE =
            "https://github.com/flamingo-stack/openframe-oss-tenant/releases/download/{version}/openframe-client_macos.tar.gz";
    private static final String GATEWAY_TEMPLATE =
            "{assetsBaseUrl}/v0/api/assets/download?agent=chat&platform=macos";

    @Test
    void shouldSubstituteVersionPlaceholder() {
        DownloadConfigurationLinkResolver resolver = new DownloadConfigurationLinkResolver("");

        String resolved = resolver.resolve(config(GITHUB_TEMPLATE), "1.0.19");

        assertThat(resolved).isEqualTo(
                "https://github.com/flamingo-stack/openframe-oss-tenant/releases/download/1.0.19/openframe-client_macos.tar.gz");
    }

    @Test
    void shouldSubstituteAssetsBaseUrlPlaceholder() {
        DownloadConfigurationLinkResolver resolver = new DownloadConfigurationLinkResolver("https://openframe.build");

        String resolved = resolver.resolve(config(GATEWAY_TEMPLATE), "1.0.19");

        assertThat(resolved).isEqualTo("https://openframe.build/v0/api/assets/download?agent=chat&platform=macos");
    }

    @Test
    void shouldStripTrailingSlashFromConfiguredBaseUrl() {
        DownloadConfigurationLinkResolver resolver = new DownloadConfigurationLinkResolver("https://openframe.build/");

        String resolved = resolver.resolve(config(GATEWAY_TEMPLATE), "1.0.19");

        assertThat(resolved).isEqualTo("https://openframe.build/v0/api/assets/download?agent=chat&platform=macos");
    }

    @Test
    void shouldLeavePlaceholderUntouchedWhenBaseUrlNotConfigured() {
        DownloadConfigurationLinkResolver resolver = new DownloadConfigurationLinkResolver("");

        String resolved = resolver.resolve(config(GATEWAY_TEMPLATE), "1.0.19");

        assertThat(resolved).isEqualTo(GATEWAY_TEMPLATE);
    }

    @Test
    void shouldLeaveTemplatesWithoutPlaceholdersUnchanged() {
        DownloadConfigurationLinkResolver resolver = new DownloadConfigurationLinkResolver("https://openframe.build");

        String plain = "https://example.com/static/openframe-client_macos.tar.gz";

        assertThat(resolver.resolve(config(plain), "1.0.19")).isEqualTo(plain);
    }

    private DownloadConfiguration config(String linkTemplate) {
        DownloadConfiguration config = new DownloadConfiguration();
        config.setLinkTemplate(linkTemplate);
        return config;
    }
}
