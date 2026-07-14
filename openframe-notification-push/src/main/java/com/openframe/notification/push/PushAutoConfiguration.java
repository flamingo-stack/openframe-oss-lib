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

/** Registered via AutoConfiguration.imports — consumers do not scan this package, so @Component here would silently never fire. */
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
            app = FirebaseApp.getInstance();
        } catch (IllegalStateException notInitialisedYet) {
            // ADC, not a key file — the GCP org bans service-account keys.
            app = FirebaseApp.initializeApp(FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.getApplicationDefault())
                    .setProjectId(projectId)
                    .setConnectTimeout((int) properties.getConnectTimeout().toMillis())
                    .setReadTimeout((int) properties.getReadTimeout().toMillis())
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
