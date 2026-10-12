package com.openframe.authz.controller;

import com.openframe.authz.dto.MobileVersionPolicyResponse;
import com.openframe.authz.dto.MobileVersionPolicyResponse.PlatformVersionPolicy;
import com.openframe.core.clientversion.MobileVersionPolicyProperties;
import com.openframe.core.clientversion.MobileVersionPolicyProperties.PlatformPolicy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

@Slf4j
@RestController
@RequestMapping("/mobile")
@RequiredArgsConstructor
public class MobileVersionPolicyController {

    private static final Duration CACHE_MAX_AGE = Duration.ofMinutes(5);

    private final MobileVersionPolicyProperties properties;

    @GetMapping(value = "/version-policy", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<MobileVersionPolicyResponse> versionPolicy() {
        CacheControl cacheControl = CacheControl.maxAge(CACHE_MAX_AGE).cachePublic();
        MobileVersionPolicyResponse response = toMobileVersionPolicyResponse();
        log.debug("Mobile version policy served: minBundleVersion={}", response.getMinBundleVersion());
        return ResponseEntity.ok()
                .cacheControl(cacheControl)
                .body(response);
    }

    private MobileVersionPolicyResponse toMobileVersionPolicyResponse() {
        PlatformVersionPolicy ios = toPlatformVersionPolicy(properties.getIos());
        PlatformVersionPolicy android = toPlatformVersionPolicy(properties.getAndroid());
        return MobileVersionPolicyResponse.builder()
                .minBundleVersion(properties.getMinBundleVersion())
                .ios(ios)
                .android(android)
                .build();
    }

    private PlatformVersionPolicy toPlatformVersionPolicy(PlatformPolicy policy) {
        return new PlatformVersionPolicy(policy.getLatestVersion(), policy.getStoreUrl());
    }
}
