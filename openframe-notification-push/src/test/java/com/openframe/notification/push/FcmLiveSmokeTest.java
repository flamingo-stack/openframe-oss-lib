package com.openframe.notification.push;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.BatchResponse;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.MulticastMessage;
import com.google.firebase.messaging.SendResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Needs gcloud ADC and network, so CI skips it. Run with FCM_LIVE_SMOKE=1 to prove a real send path:
 * everything else in this module mocks FirebaseMessaging and therefore cannot.
 */
@EnabledIfEnvironmentVariable(named = "FCM_LIVE_SMOKE", matches = "1")
class FcmLiveSmokeTest {

    @Test
    @DisplayName("Given real ADC, when a bogus token is pushed to the real FCM, then FCM rejects the TOKEN — proving credentials were accepted and the whole SDK path works")
    void adc_authenticates_against_real_fcm() throws Exception {
        FirebaseApp app = FirebaseApp.initializeApp(FirebaseOptions.builder()
                .setCredentials(GoogleCredentials.getApplicationDefault())
                .setProjectId(System.getenv().getOrDefault("FCM_PROJECT_ID", "flamingo-271f8"))
                .build(), "live-smoke");

        BatchResponse response = FirebaseMessaging.getInstance(app).sendEachForMulticast(
                MulticastMessage.builder()
                        .addAllTokens(List.of("definitely-not-a-real-fcm-token"))
                        .putData("notificationId", "smoke")
                        .build());

        SendResponse only = response.getResponses().get(0);
        assertThat(only.isSuccessful()).isFalse();
        assertThat(only.getException().getMessagingErrorCode()).isEqualTo(MessagingErrorCode.INVALID_ARGUMENT);
        assertThat(only.getException()).hasMessageContaining("registration token");
    }
}
