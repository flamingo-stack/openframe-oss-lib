package com.openframe.data.nats.resolver;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import static org.springframework.util.StringUtils.hasText;

@Component
@Slf4j
public class DownloadConfigurationLinkResolver {

    private static final String VERSION_PLACEHOLDER = "{version}";
    private static final String ASSETS_BASE_URL_PLACEHOLDER = "{assetsBaseUrl}";

    private final String assetsBaseUrl;

    /**
     * Base URL of the shared gateway assets endpoint (e.g. {@code https://openframe.ai}),
     * substituted for {@code {assetsBaseUrl}} in link templates. Empty by default, so templates
     * that do not use the placeholder — and deployments that do not set the property — resolve
     * exactly as before.
     */
    public DownloadConfigurationLinkResolver(@Value("${openframe.assets.base-url:}") String assetsBaseUrl) {
        this.assetsBaseUrl = stripTrailingSlash(assetsBaseUrl);
    }

    public String resolve(DownloadConfiguration config, String version) {
        String linkTemplate = config.getLinkTemplate();
        String resolvedLink = resolveLink(linkTemplate, version);
        log.debug("Resolved link template '{}' to '{}'", linkTemplate, resolvedLink);
        return resolvedLink;
    }

    private String resolveLink(String linkTemplate, String version) {
        String link = linkTemplate.replace(VERSION_PLACEHOLDER, version);
        if (hasText(assetsBaseUrl)) {
            link = link.replace(ASSETS_BASE_URL_PLACEHOLDER, assetsBaseUrl);
        }
        return link;
    }

    private static String stripTrailingSlash(String value) {
        return value != null && value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

}
