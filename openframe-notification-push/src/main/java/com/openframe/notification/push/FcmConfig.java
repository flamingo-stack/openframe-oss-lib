package com.openframe.notification.push;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;

/**
 * Authenticates to FCM with Application Default Credentials — no service-account JSON anywhere.
 *
 * <p>This is not a preference: the GCP org enforces {@code iam.disableServiceAccountKeyCreation}, so a
 * key file cannot even be issued. ADC resolves per environment from the same line of code — in GKE it
 * picks up the pod's Workload Identity token, locally it picks up {@code gcloud auth
 * application-default login}. Nothing to store, rotate, or leak.
 */
@Slf4j
@Configuration
@ConditionalOnProperty(name = "openframe.features.push.enabled", havingValue = "true")
@EnableConfigurationProperties(FcmProperties.class)
public class FcmConfig {

    @Bean
    @ConditionalOnMissingBean
    public FirebaseMessaging firebaseMessaging(FcmProperties properties) throws IOException {
        String projectId = properties.getProjectId();
        if (projectId == null || projectId.isBlank()) {
            throw new IllegalStateException(
                    "openframe.push.fcm.project-id must be set when push is enabled — "
                            + "Application Default Credentials carry no project and FCM cannot infer one");
        }

        FirebaseApp app = FirebaseApp.getApps().isEmpty()
                ? FirebaseApp.initializeApp(FirebaseOptions.builder()
                        .setCredentials(GoogleCredentials.getApplicationDefault())
                        .setProjectId(projectId)
                        .build())
                : FirebaseApp.getInstance();

        log.info("FCM push enabled for project {} (Application Default Credentials)", projectId);
        return FirebaseMessaging.getInstance(app);
    }
}
