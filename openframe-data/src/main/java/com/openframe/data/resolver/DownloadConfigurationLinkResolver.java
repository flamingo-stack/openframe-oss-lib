package com.openframe.data.resolver;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
@Slf4j
public class DownloadConfigurationLinkResolver {

    private static final String LATEST_VERSION_TAG = "latest";
    private static final String VERSION_TAG_PATH = "download/{version}";
    private static final String LATEST_VERSION_TAG_PATH = "latest/download";
    private static final String VERSION_PLACEHOLDER = "{version}";


    public String resolve(DownloadConfiguration config, String version) {
        String linkTemplate = config.getLinkTemplate();
        String resolvedLink = resolveLink(linkTemplate, version);
        log.debug("Resolved link template '{}' to '{}'", linkTemplate, resolvedLink);
        return resolvedLink;
    }

    private String resolveLink(String linkTemplate, String version) {
        if (isLatestVersion(version)) {
            return linkTemplate.replace(VERSION_TAG_PATH, LATEST_VERSION_TAG_PATH);
        }
        return linkTemplate.replace(VERSION_PLACEHOLDER, version);
    }

    private boolean isLatestVersion(String version) {
        return version.equals(LATEST_VERSION_TAG);
    }
    
}

