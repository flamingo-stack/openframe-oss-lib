package com.openframe.data.config;

import com.openframe.data.document.packagesearch.PackageManagerType;
import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.stream.Stream;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "openframe.package-managers")
public class PackageManagerProperties {

    private static final String FEED_URL_SCHEME = "https://";
    private static final String FEED_INDEX_FILE = "/index.json";

    private boolean chocoEnabled = false;
    private Choco choco = new Choco();

    @PostConstruct
    public void validate() {
        if (!chocoEnabled) {
            return;
        }
        if (!hasChocoPin()) {
            throw new IllegalStateException("openframe.package-managers.choco.feed-url, version and sha256 are "
                    + "required while openframe.package-managers.choco-enabled is true");
        }
        if (!isFeedIndexUrl(choco.getFeedUrl())) {
            throw new IllegalStateException("openframe.package-managers.choco.feed-url must start with "
                    + FEED_URL_SCHEME + " and end with " + FEED_INDEX_FILE);
        }
    }

    public boolean isDisabled(PackageManagerType type) {
        return type == PackageManagerType.CHOCO && !chocoEnabled;
    }

    private boolean hasChocoPin() {
        return Stream.of(choco.getFeedUrl(), choco.getVersion(), choco.getSha256())
                .allMatch(StringUtils::hasText);
    }

    private static boolean isFeedIndexUrl(String feedUrl) {
        return feedUrl.startsWith(FEED_URL_SCHEME) && feedUrl.endsWith(FEED_INDEX_FILE);
    }

    @Getter
    @Setter
    public static class Choco {

        private String feedUrl;
        private String version;
        private String sha256;
    }
}
