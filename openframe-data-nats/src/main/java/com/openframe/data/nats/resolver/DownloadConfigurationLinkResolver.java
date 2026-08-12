package com.openframe.data.nats.resolver;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

import static org.springframework.util.StringUtils.hasText;

@Component
@Slf4j
public class DownloadConfigurationLinkResolver {

    private static final String VERSION_PLACEHOLDER = "{version}";
    private static final String ASSETS_BASE_URL_PLACEHOLDER = "{assetsBaseUrl}";

    private final String assetsBaseUrl;
    private final AssetsBaseUrlProvider assetsBaseUrlProvider;

    public DownloadConfigurationLinkResolver(
            @Value("${openframe.assets.base-url:}") String assetsBaseUrl,
            @Nullable AssetsBaseUrlProvider assetsBaseUrlProvider) {
        this.assetsBaseUrl = stripTrailingSlashes(assetsBaseUrl);
        this.assetsBaseUrlProvider = assetsBaseUrlProvider;
    }

    public String resolve(DownloadConfiguration config, String version) {
        String linkTemplate = config.getLinkTemplate();
        String resolvedLink = resolveLink(linkTemplate, version);
        log.debug("Resolved link template '{}' to '{}'", linkTemplate, resolvedLink);
        return resolvedLink;
    }

    private String resolveLink(String linkTemplate, String version) {
        String link = linkTemplate.replace(VERSION_PLACEHOLDER, version);
        String baseUrl = resolveAssetsBaseUrl();
        if (hasText(baseUrl)) {
            link = link.replace(ASSETS_BASE_URL_PLACEHOLDER, baseUrl);
        }
        return link;
    }

    /**
     * Resolved per call, not at construction: a provider's value may change at runtime
     * (e.g. a tenant domain assigned after startup).
     */
    private String resolveAssetsBaseUrl() {
        if (assetsBaseUrlProvider != null) {
            String provided = stripTrailingSlashes(assetsBaseUrlProvider.getAssetsBaseUrl());
            if (hasText(provided)) {
                return provided;
            }
        }
        return assetsBaseUrl;
    }

    private static String stripTrailingSlashes(String value) {
        return value == null ? null : value.replaceAll("/+$", "");
    }

}
