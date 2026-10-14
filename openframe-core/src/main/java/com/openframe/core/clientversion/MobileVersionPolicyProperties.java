package com.openframe.core.clientversion;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "openframe.mobile.version-policy")
public class MobileVersionPolicyProperties {

    private boolean enabled;
    private String minBundleVersion;
    private PlatformPolicy ios = new PlatformPolicy();
    private PlatformPolicy android = new PlatformPolicy();
    private boolean enforceMissingHeader;

    public String storeUrl(ClientKind kind) {
        return switch (kind) {
            case IOS -> ios.getStoreUrl();
            case ANDROID -> android.getStoreUrl();
            default -> null;
        };
    }

    @Getter
    @Setter
    public static class PlatformPolicy {
        private String latestVersion;
        private String storeUrl;
    }
}
