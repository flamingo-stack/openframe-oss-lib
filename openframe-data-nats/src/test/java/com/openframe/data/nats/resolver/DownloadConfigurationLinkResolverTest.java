package com.openframe.data.nats.resolver;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class DownloadConfigurationLinkResolverTest {

    private static final String GITHUB_TEMPLATE =
            "https://github.com/flamingo-stack/openframe-oss-tenant/releases/download/{version}/openframe-client_macos.tar.gz";
    private static final String GATEWAY_TEMPLATE =
            "{assetsBaseUrl}/v0/api/assets/download?agent=chat&platform=macos";

    @Test
    void shouldSubstituteVersionPlaceholder() {
        DownloadConfigurationLinkResolver resolver = new DownloadConfigurationLinkResolver("", null);

        String resolved = resolver.resolve(config(GITHUB_TEMPLATE), "1.0.19");

        assertThat(resolved).isEqualTo(
                "https://github.com/flamingo-stack/openframe-oss-tenant/releases/download/1.0.19/openframe-client_macos.tar.gz");
    }

    @Test
    void shouldSubstituteAssetsBaseUrlPlaceholder() {
        DownloadConfigurationLinkResolver resolver = new DownloadConfigurationLinkResolver("https://openframe.build", null);

        String resolved = resolver.resolve(config(GATEWAY_TEMPLATE), "1.0.19");

        assertThat(resolved).isEqualTo("https://openframe.build/v0/api/assets/download?agent=chat&platform=macos");
    }

    @Test
    void shouldStripTrailingSlashFromConfiguredBaseUrl() {
        DownloadConfigurationLinkResolver resolver = new DownloadConfigurationLinkResolver("https://openframe.build/", null);

        String resolved = resolver.resolve(config(GATEWAY_TEMPLATE), "1.0.19");

        assertThat(resolved).isEqualTo("https://openframe.build/v0/api/assets/download?agent=chat&platform=macos");
    }

    @Test
    void shouldStripAllConsecutiveTrailingSlashesFromConfiguredBaseUrl() {
        DownloadConfigurationLinkResolver resolver = new DownloadConfigurationLinkResolver("https://openframe.build///", null);

        String resolved = resolver.resolve(config(GATEWAY_TEMPLATE), "1.0.19");

        assertThat(resolved).isEqualTo("https://openframe.build/v0/api/assets/download?agent=chat&platform=macos");
    }

    @Test
    void shouldLeavePlaceholderUntouchedWhenBaseUrlNotConfigured() {
        DownloadConfigurationLinkResolver resolver = new DownloadConfigurationLinkResolver("", null);

        String resolved = resolver.resolve(config(GATEWAY_TEMPLATE), "1.0.19");

        assertThat(resolved).isEqualTo(GATEWAY_TEMPLATE);
    }

    @Test
    void shouldLeaveTemplatesWithoutPlaceholdersUnchanged() {
        DownloadConfigurationLinkResolver resolver = new DownloadConfigurationLinkResolver("https://openframe.build", null);

        String plain = "https://example.com/static/openframe-client_macos.tar.gz";

        assertThat(resolver.resolve(config(plain), "1.0.19")).isEqualTo(plain);
    }

    @Test
    void shouldPreferProviderBaseUrlOverProperty() {
        DownloadConfigurationLinkResolver resolver = new DownloadConfigurationLinkResolver(
                "https://openframe.build", () -> "https://tenant1.openframe.build");

        String resolved = resolver.resolve(config(GATEWAY_TEMPLATE), "1.0.19");

        assertThat(resolved).isEqualTo("https://tenant1.openframe.build/v0/api/assets/download?agent=chat&platform=macos");
    }

    @Test
    void shouldStripTrailingSlashesFromProviderBaseUrl() {
        DownloadConfigurationLinkResolver resolver = new DownloadConfigurationLinkResolver(
                "", () -> "https://tenant1.openframe.build//");

        String resolved = resolver.resolve(config(GATEWAY_TEMPLATE), "1.0.19");

        assertThat(resolved).isEqualTo("https://tenant1.openframe.build/v0/api/assets/download?agent=chat&platform=macos");
    }

    @Test
    void shouldFallBackToPropertyWhenProviderReturnsBlank() {
        DownloadConfigurationLinkResolver resolver = new DownloadConfigurationLinkResolver(
                "https://openframe.build", () -> "");

        String resolved = resolver.resolve(config(GATEWAY_TEMPLATE), "1.0.19");

        assertThat(resolved).isEqualTo("https://openframe.build/v0/api/assets/download?agent=chat&platform=macos");
    }

    @Test
    void shouldFallBackToPropertyWhenProviderReturnsNull() {
        DownloadConfigurationLinkResolver resolver = new DownloadConfigurationLinkResolver(
                "https://openframe.build", () -> null);

        String resolved = resolver.resolve(config(GATEWAY_TEMPLATE), "1.0.19");

        assertThat(resolved).isEqualTo("https://openframe.build/v0/api/assets/download?agent=chat&platform=macos");
    }

    @Test
    void shouldConsultProviderOnEveryResolution() {
        AtomicReference<String> providerValue = new AtomicReference<>("");
        DownloadConfigurationLinkResolver resolver = new DownloadConfigurationLinkResolver(
                "https://openframe.build", providerValue::get);

        assertThat(resolver.resolve(config(GATEWAY_TEMPLATE), "1.0.19"))
                .isEqualTo("https://openframe.build/v0/api/assets/download?agent=chat&platform=macos");

        providerValue.set("https://tenant1.openframe.build");

        assertThat(resolver.resolve(config(GATEWAY_TEMPLATE), "1.0.19"))
                .isEqualTo("https://tenant1.openframe.build/v0/api/assets/download?agent=chat&platform=macos");
    }

    private DownloadConfiguration config(String linkTemplate) {
        DownloadConfiguration config = new DownloadConfiguration();
        config.setLinkTemplate(linkTemplate);
        return config;
    }
}
