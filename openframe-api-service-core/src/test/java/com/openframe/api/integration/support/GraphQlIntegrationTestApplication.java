package com.openframe.api.integration.support;

import com.openframe.api.config.DateScalarConfig;
import com.openframe.api.config.InstantScalarConfig;
import com.openframe.api.config.LongScalarConfig;
import com.openframe.api.datafetcher.NotificationDataFetcher;
import com.openframe.api.datafetcher.notification.NotificationContextGraphQlTypeResolver;
import com.openframe.api.integration.datafetcher.notification.TestApprovalContextTypeResolver;
import com.openframe.api.mapper.GraphQLNotificationMapper;
import com.openframe.api.service.NotificationService;
import com.openframe.data.config.NotificationContextMongoConfig;
import com.openframe.data.config.NotificationContextJacksonConfig;
import com.openframe.data.nats.service.NotificationPublishingService;
import com.openframe.data.repository.notification.NotificationRepository;
import com.openframe.data.repository.notification.impl.CustomNotificationReadStateRepositoryImpl;
import com.openframe.data.repository.notification.impl.CustomNotificationRepositoryImpl;
import com.openframe.data.service.notification.NotificationReadStateService;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.cassandra.CassandraAutoConfiguration;
import org.springframework.boot.autoconfigure.data.cassandra.CassandraDataAutoConfiguration;
import org.springframework.boot.autoconfigure.data.cassandra.CassandraReactiveDataAutoConfiguration;
import org.springframework.boot.autoconfigure.data.cassandra.CassandraReactiveRepositoriesAutoConfiguration;
import org.springframework.boot.autoconfigure.data.cassandra.CassandraRepositoriesAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration;
import org.springframework.boot.autoconfigure.kafka.KafkaAutoConfiguration;
import org.springframework.boot.autoconfigure.security.oauth2.resource.servlet.OAuth2ResourceServerAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

@SpringBootConfiguration
@EnableAutoConfiguration(exclude = {
        SecurityAutoConfiguration.class,
        OAuth2ResourceServerAutoConfiguration.class,
        UserDetailsServiceAutoConfiguration.class,
        CassandraAutoConfiguration.class,
        CassandraDataAutoConfiguration.class,
        CassandraReactiveDataAutoConfiguration.class,
        CassandraRepositoriesAutoConfiguration.class,
        CassandraReactiveRepositoriesAutoConfiguration.class,
        KafkaAutoConfiguration.class,
        RedisAutoConfiguration.class,
        RedisRepositoriesAutoConfiguration.class
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
        NotificationDataFetcher.class,
        NotificationContextGraphQlTypeResolver.class,
        TestApprovalContextTypeResolver.class,
        NotificationContextMongoConfig.class,
        NotificationContextJacksonConfig.class,
        InstantScalarConfig.class,
        DateScalarConfig.class,
        LongScalarConfig.class
})
public class GraphQlIntegrationTestApplication {
}
