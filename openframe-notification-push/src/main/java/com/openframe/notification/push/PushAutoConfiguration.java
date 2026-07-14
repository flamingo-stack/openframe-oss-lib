package com.openframe.notification.push;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import com.openframe.data.nats.channel.NotificationChannel;
import com.openframe.data.repository.push.PushDeviceRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

import java.io.IOException;

/**
 * Registered via META-INF/spring/…AutoConfiguration.imports, NOT component scanning: consuming
 * services scan only com.openframe.{data,core,api,…}, so a @Component in this package would never be
 * found and push would silently never fire.
 *
 * <p>Credentials are Application Default Credentials, never a service-account key — the GCP org
 * enforces iam.disableServiceAccountKeyCreation, so no key can be issued. The same call resolves
 * Workload Identity in GKE and gcloud ADC locally.
 */
@Slf4j
@AutoConfiguration
@ConditionalOnProperty(name = "openframe.features.push.enabled", havingValue = "true")
@EnableConfigurationProperties(FcmProperties.class)
public class PushAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public FirebaseMessaging firebaseMessaging(FcmProperties properties) throws IOException {
        String projectId = properties.getProjectId();
        if (projectId == null || projectId.isBlank()) {
            throw new IllegalStateException(
                    "openframe.push.fcm.project-id must be set when push is enabled — "
                            + "Application Default Credentials carry no project and FCM cannot infer one");
        }

        FirebaseApp app;
        try {
            // Keys off the DEFAULT app specifically: getApps() would also count a differently-named app,
            // and getInstance() only ever returns the default one.
            app = FirebaseApp.getInstance();
        } catch (IllegalStateException notInitialisedYet) {
            app = FirebaseApp.initializeApp(FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.getApplicationDefault())
                    .setProjectId(projectId)
                    .setConnectTimeout(properties.getConnectTimeoutMillis())
                    .setReadTimeout(properties.getReadTimeoutMillis())
                    .build());
            log.info("FCM push enabled for project {}", projectId);
        }
        return FirebaseMessaging.getInstance(app);
    }

    @Bean
    @ConditionalOnMissingBean(name = "fcmPushChannel")
    public NotificationChannel fcmPushChannel(FirebaseMessaging firebaseMessaging,
                                              PushDeviceRepository deviceRepository,
                                              ObjectMapper objectMapper,
                                              FcmProperties properties) {
        return new FcmPushSender(firebaseMessaging, deviceRepository, objectMapper, properties);
    }
}
