package com.openframe.api.integration.support;

import com.openframe.api.mapper.GraphQLNotificationMapper;
import com.openframe.api.service.NotificationService;
import com.openframe.data.config.NotificationContextMongoConfig;
import com.openframe.data.nats.service.NotificationPublishingService;
import com.openframe.data.repository.notification.NotificationRepository;
import com.openframe.data.repository.notification.impl.CustomNotificationReadStateRepositoryImpl;
import com.openframe.data.repository.notification.impl.CustomNotificationRepositoryImpl;
import com.openframe.data.service.notification.NotificationReadStateService;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.data.mongo.MongoDataAutoConfiguration;
import org.springframework.boot.autoconfigure.data.mongo.MongoRepositoriesAutoConfiguration;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.autoconfigure.mongo.MongoAutoConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

@SpringBootConfiguration
@ImportAutoConfiguration({
        MongoAutoConfiguration.class,
        MongoDataAutoConfiguration.class,
        MongoRepositoriesAutoConfiguration.class,
        JacksonAutoConfiguration.class
})
@EnableMongoAuditing
@EnableMongoRepositories(basePackageClasses = NotificationRepository.class)
@Import({
        CustomNotificationRepositoryImpl.class,
        CustomNotificationReadStateRepositoryImpl.class,
        NotificationPublishingService.class,
        NotificationReadStateService.class,
        NotificationService.class,
        GraphQLNotificationMapper.class,
        NotificationContextMongoConfig.class
})
public class ServiceIntegrationTestApplication {
}
