package com.openframe.data.config;

import org.bson.Document;
import org.bson.types.Decimal128;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.data.mongodb.core.convert.MappingMongoConverter;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.convert.NoOpDbRefResolver;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class MongoCustomConversionsConfigTest {

    private MappingMongoConverter converter;

    @BeforeEach
    void setUp() {
        MongoCustomConversions conversions = new MongoCustomConversionsConfig()
                .mongoCustomConversions(new DefaultListableBeanFactory().getBeanProvider(MongoConversionsContributor.class));
        MongoMappingContext mappingContext = new MongoMappingContext();
        mappingContext.setSimpleTypeHolder(conversions.getSimpleTypeHolder());
        mappingContext.afterPropertiesSet();
        converter = new MappingMongoConverter(NoOpDbRefResolver.INSTANCE, mappingContext);
        converter.setCustomConversions(conversions);
        converter.afterPropertiesSet();
    }

    @Test
    void shouldWriteBigDecimalAsString() {
        Document document = new Document();

        converter.write(new Priced(new BigDecimal("12.50")), document);

        assertThat(document.get("amountUsd")).isEqualTo("12.50");
    }

    @Test
    void shouldReadBigDecimalWrittenEitherAsStringOrAsDecimal128() {
        Priced fromString = converter.read(Priced.class, new Document("amountUsd", "12.50"));
        Priced fromDecimal128 = converter.read(Priced.class, new Document("amountUsd", new Decimal128(new BigDecimal("12.50"))));

        assertThat(fromString.amountUsd()).isEqualByComparingTo("12.50");
        assertThat(fromDecimal128.amountUsd()).isEqualByComparingTo("12.50");
    }

    record Priced(BigDecimal amountUsd) {
    }
}
