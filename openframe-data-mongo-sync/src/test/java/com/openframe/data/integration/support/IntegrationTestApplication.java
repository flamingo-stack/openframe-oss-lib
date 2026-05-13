package com.openframe.data.integration.support;

import com.openframe.data.config.NotificationContextMongoConfig;
import com.openframe.data.config.notification.NotificationIndexConfiguration;
import com.openframe.data.integration.document.notification.TestExtendedContextDescriptor;
import com.openframe.data.repository.notification.NotificationRepository;
import com.openframe.data.repository.notification.impl.CustomNotificationReadStateRepositoryImpl;
import com.openframe.data.repository.notification.impl.CustomNotificationRepositoryImpl;
import com.openframe.data.service.notification.NotificationReadStateService;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

@SpringBootConfiguration
@EnableAutoConfiguration
@EnableMongoAuditing
@EnableMongoRepositories(basePackageClasses = NotificationRepository.class)
@Import({
        CustomNotificationRepositoryImpl.class,
        CustomNotificationReadStateRepositoryImpl.class,
        NotificationReadStateService.class,
        NotificationContextMongoConfig.class,
        NotificationIndexConfiguration.class,
        TestExtendedContextDescriptor.class
})
public class IntegrationTestApplication {
}
