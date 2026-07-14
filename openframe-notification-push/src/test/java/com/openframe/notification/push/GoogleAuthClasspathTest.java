package com.openframe.notification.push;

import com.google.auth.oauth2.GoogleCredentials;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.net.URL;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

class GoogleAuthClasspathTest {

    @Test
    @DisplayName("Given the module's classpath, when google-auth is resolved, then both halves come from one version — a split makes FCM auth die with NoClassDefFoundError on the first token refresh, which no mocked test can see")
    void google_auth_halves_are_not_split() {
        assertThatCode(() -> Class.forName("com.google.auth.CredentialTypeForMetrics"))
                .doesNotThrowAnyException();

        assertThat(jarOf(com.google.auth.Credentials.class))
                .isEqualTo(jarOf(GoogleCredentials.class));
    }

    private static String jarOf(Class<?> type) {
        URL location = type.getProtectionDomain().getCodeSource().getLocation();
        return location.getPath().replaceAll(".*/google-auth-library-[a-z2-]+/([^/]+)/.*", "$1");
    }
}
