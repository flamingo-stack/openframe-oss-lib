package com.openframe.data.сonfig;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.core.convert.DbRefResolver;
import org.springframework.data.mongodb.core.convert.DefaultDbRefResolver;
import org.springframework.data.mongodb.core.convert.MappingMongoConverter;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;
import org.springframework.data.mongodb.repository.config.EnableReactiveMongoRepositories;

@Configuration
public class MongoConfig {

    @Configuration
    @ConditionalOnProperty(name = "spring.data.mongodb.enabled", havingValue = "true", matchIfMissing = false)
    @EnableMongoRepositories(basePackages = "com.openframe.data.repository")
    public static class MongoConfiguration {

        @Bean
        public MappingMongoConverter mappingMongoConverter(MongoDatabaseFactory factory,
                                                           MongoMappingContext context,
                                                           MongoCustomConversions conversions) {
            DbRefResolver dbRefResolver = new DefaultDbRefResolver(factory);
            MappingMongoConverter converter = new MappingMongoConverter(dbRefResolver, context);
            converter.setCustomConversions(conversions);
            converter.setMapKeyDotReplacement("__dot__");
            return converter;
        }
    }

    @Configuration
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.REACTIVE)
    @EnableReactiveMongoRepositories(basePackages = "com.openframe.data.reactive.repository")
    public static class ReactiveMongoConfiguration {
    }
}