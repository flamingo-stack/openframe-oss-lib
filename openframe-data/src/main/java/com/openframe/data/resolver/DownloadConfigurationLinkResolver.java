package com.openframe.data.resolver;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
@Slf4j
public class DownloadConfigurationLinkResolver {

    private static final String VERSION_PLACEHOLDER = "{version}";

    public String resolve(DownloadConfiguration config, String version) {
        String linkTemplate = config.getLinkTemplate();
        String resolvedLink = linkTemplate.replace(VERSION_PLACEHOLDER, version);
        log.debug("Resolved link template '{}' to '{}'", linkTemplate, resolvedLink);
        return resolvedLink;
    }
    
}

