package com.openframe.data.config;

import org.springframework.boot.autoconfigure.AutoConfigureBefore;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.data.mongo.MongoDataAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.core.convert.DbRefResolver;
import org.springframework.data.mongodb.core.convert.DefaultDbRefResolver;
import org.springframework.data.mongodb.core.convert.MappingMongoConverter;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;

@Configuration
@ConditionalOnProperty(name = "spring.data.mongodb.enabled", havingValue = "true", matchIfMissing = false)
@AutoConfigureBefore(MongoDataAutoConfiguration.class)
@EnableMongoAuditing
public class MongoInfraConfig {

    /**
     * Fallback {@link MongoCustomConversions} that pins UTC {@link java.time.LocalDate} &lt;-&gt; {@code Date}
     * conversion (see {@link LocalDateUtcMongoConverters}) so dates are stored/read identically regardless
     * of the JVM/container timezone. Backs off when another config already provides a conversions bean
     * (e.g. {@code NotificationContextMongoConfig}, which adds the same UTC converters alongside its own),
     * so there is never a duplicate {@code MongoCustomConversions} bean.
     */
    @Bean
    @ConditionalOnMissingBean(MongoCustomConversions.class)
    public MongoCustomConversions mongoCustomConversions() {
        return new MongoCustomConversions(LocalDateUtcMongoConverters.converters());
    }

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
