package com.openframe.data.integration.support;

import com.openframe.data.config.NotificationContextMongoConfig;
import com.openframe.data.integration.document.notification.TestExtendedContextBinding;
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
        TestExtendedContextBinding.class
})
public class IntegrationTestApplication {
}
