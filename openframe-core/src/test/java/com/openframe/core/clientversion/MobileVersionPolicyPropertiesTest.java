package com.openframe.core.clientversion;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import static org.assertj.core.api.Assertions.assertThat;

class MobileVersionPolicyPropertiesTest {

    private static final String IOS_STORE_URL = "itms-apps://apps.apple.com/app/id6801064262";
    private static final String ANDROID_STORE_URL = "market://details?id=ai.openframe.mobile";

    private MobileVersionPolicyProperties properties;

    @BeforeEach
    void setUp() {
        properties = new MobileVersionPolicyProperties();
        properties.getIos().setStoreUrl(IOS_STORE_URL);
        properties.getAndroid().setStoreUrl(ANDROID_STORE_URL);
    }

    @Test
    void storeUrl_iosKind_iosStoreUrlReturned() {
        // setup - properties prepared in setUp

        // execution
        String storeUrl = properties.storeUrl(ClientKind.IOS);

        // verifications
        assertThat(storeUrl).isEqualTo(IOS_STORE_URL);
    }

    @Test
    void storeUrl_androidKind_androidStoreUrlReturned() {
        // setup - properties prepared in setUp

        // execution
        String storeUrl = properties.storeUrl(ClientKind.ANDROID);

        // verifications
        assertThat(storeUrl).isEqualTo(ANDROID_STORE_URL);
    }

    @ParameterizedTest
    @EnumSource(value = ClientKind.class, names = {"WEB", "DESKTOP", "UNKNOWN"})
    void storeUrl_kindWithoutStore_nullReturned(ClientKind kind) {
        // setup - properties prepared in setUp

        // execution
        String storeUrl = properties.storeUrl(kind);

        // verifications
        assertThat(storeUrl).isNull();
    }
}
