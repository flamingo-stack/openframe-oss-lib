package com.openframe.data.config;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingClass;
import org.springframework.boot.data.mongodb.autoconfigure.DataMongoProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions.BigDecimalRepresentation;

import java.util.Optional;

@Configuration
@ConditionalOnMissingClass("com.openframe.data.config.MongoCustomConversionsConfig")
public class MongoReactiveConversionsConfig {

    @Bean
    public MongoCustomConversions mongoCustomConversions(ObjectProvider<DataMongoProperties> properties) {
        DataMongoProperties dataMongo = properties.getIfAvailable(DataMongoProperties::new);
        Optional<BigDecimalRepresentation> bigDecimal = Optional.ofNullable(dataMongo.getRepresentation().getBigDecimal());
        return MongoCustomConversions.create(adapter -> {
            bigDecimal.ifPresent(adapter::bigDecimal);
            adapter.registerConverter(DeviceStatusReadingConverter.INSTANCE);
        });
    }
}
