package com.openframe.authz.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public class MobileVersionPolicyResponse {

    private final String minBundleVersion;
    private final PlatformVersionPolicy ios;
    private final PlatformVersionPolicy android;

    @Getter
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_EMPTY)
    public static class PlatformVersionPolicy {
        private final String latestVersion;
        private final String storeUrl;
    }
}
