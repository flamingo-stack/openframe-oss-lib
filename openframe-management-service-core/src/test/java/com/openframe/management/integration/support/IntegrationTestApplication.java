package com.openframe.management.integration.support;

import com.openframe.data.config.NotificationContextMongoConfig;
import com.openframe.data.repository.notification.NotificationRepository;
import com.openframe.data.repository.notification.impl.CustomNotificationRepositoryImpl;
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
        NotificationContextMongoConfig.class
})
public class IntegrationTestApplication {
}
