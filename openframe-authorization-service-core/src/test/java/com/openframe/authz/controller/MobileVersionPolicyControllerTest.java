package com.openframe.authz.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.authz.dto.MobileVersionPolicyResponse;
import com.openframe.core.clientversion.MobileVersionPolicyProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MobileVersionPolicyControllerTest {

    private static final String MIN_BUNDLE_VERSION = "1.0.120";
    private static final String LATEST_VERSION = "1.0.2";
    private static final String IOS_STORE_URL = "itms-apps://apps.apple.com/app/id6801064262";
    private static final String ANDROID_STORE_URL = "market://details?id=ai.openframe.mobile";

    private final ObjectMapper objectMapper = new ObjectMapper();

    private MobileVersionPolicyProperties properties;
    private MobileVersionPolicyController controller;

    @BeforeEach
    void setUp() {
        properties = new MobileVersionPolicyProperties();
        properties.setEnabled(true);
        controller = new MobileVersionPolicyController(properties);
    }

    @Test
    void versionPolicy_policyConfigured_policyReturnedWithoutEnforceFlag() {
        // setup
        properties.setMinBundleVersion(MIN_BUNDLE_VERSION);
        properties.setEnforceMissingHeader(true);
        properties.getIos().setLatestVersion(LATEST_VERSION);
        properties.getIos().setStoreUrl(IOS_STORE_URL);
        properties.getAndroid().setLatestVersion(LATEST_VERSION);
        properties.getAndroid().setStoreUrl(ANDROID_STORE_URL);
        Map<String, Object> expected = Map.of(
                "minBundleVersion", MIN_BUNDLE_VERSION,
                "ios", Map.of("latestVersion", LATEST_VERSION, "storeUrl", IOS_STORE_URL),
                "android", Map.of("latestVersion", LATEST_VERSION, "storeUrl", ANDROID_STORE_URL));

        // execution
        ResponseEntity<MobileVersionPolicyResponse> response = controller.versionPolicy();

        // verifications
        Map<?, ?> body = objectMapper.convertValue(response.getBody(), Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(body).isEqualTo(expected);
    }

    @Test
    void versionPolicy_featureDisabled_throwsNotFound() {
        // setup
        properties.setEnabled(false);
        properties.setMinBundleVersion(MIN_BUNDLE_VERSION);

        // execution
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> controller.versionPolicy());

        // verifications
        assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(ex.getMessage()).contains("404 NOT_FOUND");
    }

    @Test
    void versionPolicy_anyPolicy_publicFiveMinuteCacheHeaderSet() {
        // setup - default properties

        // execution
        ResponseEntity<MobileVersionPolicyResponse> response = controller.versionPolicy();

        // verifications
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("max-age=300, public");
    }

    @Test
    void versionPolicy_versionsEmpty_emptyFieldsOmitted() {
        // setup
        properties.setMinBundleVersion("");
        properties.getIos().setLatestVersion("");
        properties.getIos().setStoreUrl(IOS_STORE_URL);
        properties.getAndroid().setLatestVersion("");
        properties.getAndroid().setStoreUrl(ANDROID_STORE_URL);
        Map<String, Object> expected = Map.of(
                "ios", Map.of("storeUrl", IOS_STORE_URL),
                "android", Map.of("storeUrl", ANDROID_STORE_URL));

        // execution
        ResponseEntity<MobileVersionPolicyResponse> response = controller.versionPolicy();

        // verifications
        Map<?, ?> body = objectMapper.convertValue(response.getBody(), Map.class);
        assertThat(body).isEqualTo(expected);
    }

    @Test
    void versionPolicy_nothingConfigured_emptyPlatformsReturned() {
        // setup
        Map<String, Object> expected = Map.of("ios", Map.of(), "android", Map.of());

        // execution
        ResponseEntity<MobileVersionPolicyResponse> response = controller.versionPolicy();

        // verifications
        Map<?, ?> body = objectMapper.convertValue(response.getBody(), Map.class);
        assertThat(body).isEqualTo(expected);
    }
}
