package com.openframe.data.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingClass;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;

@Configuration
@ConditionalOnMissingClass("com.openframe.data.config.MongoCustomConversionsConfig")
public class MongoReactiveConversionsConfig {

    @Bean
    public MongoCustomConversions mongoCustomConversions() {
        return MongoCustomConversions.create(adapter -> adapter.registerConverter(DeviceStatusReadingConverter.INSTANCE));
    }
}
