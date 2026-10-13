package com.openframe.core.clientversion;

import com.openframe.core.clientversion.MobileVersionPolicyProperties.PlatformPolicy;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.context.ConfigurationPropertiesAutoConfiguration;
import org.springframework.boot.test.util.TestPropertyValues;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;

class MobileVersionPolicyPropertiesBindingTest {

    private static final String PREFIX = "openframe.mobile.version-policy.";
    private static final String IOS_STORE_URL = "itms-apps://apps.apple.com/app/id6801064262";
    private static final String ANDROID_STORE_URL = "market://details?id=ai.openframe.mobile";

    private AnnotationConfigApplicationContext context;

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigApplicationContext();
        context.register(ConfigurationPropertiesAutoConfiguration.class, MobileVersionPolicyProperties.class);
    }

    @AfterEach
    void tearDown() {
        context.close();
    }

    @Test
    void bind_allKeysConfigured_everyFieldBound() {
        // setup
        TestPropertyValues.of(
                PREFIX + "enabled=true",
                PREFIX + "min-bundle-version=1.0.120",
                PREFIX + "ios.latest-version=1.0.2",
                PREFIX + "ios.store-url=" + IOS_STORE_URL,
                PREFIX + "android.latest-version=1.0.3",
                PREFIX + "android.store-url=" + ANDROID_STORE_URL,
                PREFIX + "enforce-missing-header=true"
        ).applyTo(context);

        // execution
        context.refresh();
        MobileVersionPolicyProperties properties = context.getBean(MobileVersionPolicyProperties.class);

        // verifications
        assertThat(properties)
                .extracting(MobileVersionPolicyProperties::isEnabled,
                        MobileVersionPolicyProperties::getMinBundleVersion,
                        MobileVersionPolicyProperties::isEnforceMissingHeader)
                .containsExactly(true, "1.0.120", true);
        assertThat(properties.getIos())
                .extracting(PlatformPolicy::getLatestVersion, PlatformPolicy::getStoreUrl)
                .containsExactly("1.0.2", IOS_STORE_URL);
        assertThat(properties.getAndroid())
                .extracting(PlatformPolicy::getLatestVersion, PlatformPolicy::getStoreUrl)
                .containsExactly("1.0.3", ANDROID_STORE_URL);
    }

    @Test
    void bind_nothingConfigured_nothingBlockedByDefault() {
        // setup - no properties

        // execution
        context.refresh();
        MobileVersionPolicyProperties properties = context.getBean(MobileVersionPolicyProperties.class);

        // verifications
        assertThat(properties)
                .extracting(MobileVersionPolicyProperties::isEnabled,
                        MobileVersionPolicyProperties::getMinBundleVersion,
                        MobileVersionPolicyProperties::isEnforceMissingHeader)
                .containsExactly(false, null, false);
        assertThat(properties.getIos())
                .extracting(PlatformPolicy::getLatestVersion, PlatformPolicy::getStoreUrl)
                .containsExactly(null, null);
    }
}
