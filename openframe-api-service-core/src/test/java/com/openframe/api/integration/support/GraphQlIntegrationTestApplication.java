package com.openframe.api.integration.support;

import com.openframe.api.config.DateScalarConfig;
import com.openframe.api.config.InstantScalarConfig;
import com.openframe.api.config.LongScalarConfig;
import com.openframe.api.datafetcher.NotificationDataFetcher;
import com.openframe.api.mapper.GraphQLNotificationMapper;
import com.openframe.api.service.NotificationService;
import com.openframe.notification.service.NotificationBroadcaster;
import com.openframe.data.repository.notification.NotificationRepository;
import com.openframe.data.repository.notification.impl.CustomNotificationReadStateRepositoryImpl;
import com.openframe.data.repository.notification.impl.CustomNotificationRepositoryImpl;
import com.openframe.notification.readstate.NotificationReadStateService;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.cassandra.autoconfigure.CassandraAutoConfiguration;
import org.springframework.boot.data.cassandra.autoconfigure.DataCassandraAutoConfiguration;
import org.springframework.boot.data.cassandra.autoconfigure.DataCassandraReactiveAutoConfiguration;
import org.springframework.boot.data.cassandra.autoconfigure.DataCassandraReactiveRepositoriesAutoConfiguration;
import org.springframework.boot.data.cassandra.autoconfigure.DataCassandraRepositoriesAutoConfiguration;
import org.springframework.boot.data.redis.autoconfigure.DataRedisAutoConfiguration;
import org.springframework.boot.data.redis.autoconfigure.DataRedisRepositoriesAutoConfiguration;
import org.springframework.boot.kafka.autoconfigure.KafkaAutoConfiguration;
import org.springframework.boot.security.autoconfigure.SecurityAutoConfiguration;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.security.autoconfigure.web.servlet.ServletWebSecurityAutoConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

@SpringBootConfiguration
@EnableAutoConfiguration(exclude = {
        SecurityAutoConfiguration.class,
        ServletWebSecurityAutoConfiguration.class,
        UserDetailsServiceAutoConfiguration.class,
        CassandraAutoConfiguration.class,
        DataCassandraAutoConfiguration.class,
        DataCassandraReactiveAutoConfiguration.class,
        DataCassandraRepositoriesAutoConfiguration.class,
        DataCassandraReactiveRepositoriesAutoConfiguration.class,
        KafkaAutoConfiguration.class,
        DataRedisAutoConfiguration.class,
        DataRedisRepositoriesAutoConfiguration.class
})
@EnableMongoAuditing
@EnableMongoRepositories(basePackageClasses = NotificationRepository.class)
@EnableMethodSecurity
@Import({
        CustomNotificationRepositoryImpl.class,
        CustomNotificationReadStateRepositoryImpl.class,
        NotificationBroadcaster.class,
        NotificationReadStateService.class,
        NotificationService.class,
        GraphQLNotificationMapper.class,
        NotificationDataFetcher.class,
        InstantScalarConfig.class,
        DateScalarConfig.class,
        LongScalarConfig.class
})
public class GraphQlIntegrationTestApplication {
}
