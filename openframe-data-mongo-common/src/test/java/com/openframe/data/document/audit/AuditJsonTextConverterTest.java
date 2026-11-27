package com.openframe.data.document.audit;

import org.bson.Document;
import org.bson.types.Decimal128;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.convert.MappingMongoConverter;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.convert.NoOpDbRefResolver;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AuditJsonTextConverterTest {

    @Test
    void write_detailsHoldingObjectsWithDifferentFields_storesThemAsOneJsonText() {
        AuditEvent event = AuditEvent.builder()
                .details(Map.of("removed", List.of(Map.of("id", "a"), new Document("id", "b").append("quantity", 2L))))
                .build();

        assertThat(stored(event).get("details"))
                .isEqualTo("{\"removed\": [{\"id\": \"a\"}, {\"id\": \"b\", \"quantity\": 2}]}");
    }

    @Test
    void write_changeOfADate_storesBothSidesAsIsoText() {
        AuditChange change = new AuditChange(Date.from(Instant.parse("2026-01-02T03:04:05.678Z")),
                Date.from(Instant.parse("2026-02-03T04:05:06Z")));

        assertThat(stored(eventWithChange("dueAt", change)).get("changes")).isEqualTo(
                "{\"dueAt\": {\"before\": \"2026-01-02T03:04:05.678Z\", \"after\": \"2026-02-03T04:05:06Z\"}}");
    }

    @Test
    void write_changeOfADecimal_storesBothSidesAsPlainNumbers() {
        AuditChange change = new AuditChange(new Decimal128(new BigDecimal("12.50")), new Decimal128(new BigDecimal("1E+3")));

        assertThat(stored(eventWithChange("price", change)).get("changes"))
                .isEqualTo("{\"price\": {\"before\": 12.50, \"after\": 1000}}");
    }

    @Test
    void write_changeOfAnObjectId_storesBothSidesAsHexText() {
        AuditChange change = new AuditChange(new ObjectId("6b00ad1543b0fde41dc40006"), new ObjectId("6b00adc643b0fde41dc4000d"));

        assertThat(stored(eventWithChange("ownerId", change)).get("changes")).isEqualTo(
                "{\"ownerId\": {\"before\": \"6b00ad1543b0fde41dc40006\", \"after\": \"6b00adc643b0fde41dc4000d\"}}");
    }

    private static AuditEvent eventWithChange(String field, AuditChange change) {
        return AuditEvent.builder().changes(Map.of(field, change)).build();
    }

    private static Document stored(AuditEvent event) {
        MongoCustomConversions conversions = new MongoCustomConversions(List.of());
        MongoMappingContext mappingContext = new MongoMappingContext();
        mappingContext.setSimpleTypeHolder(conversions.getSimpleTypeHolder());
        MappingMongoConverter converter = new MappingMongoConverter(NoOpDbRefResolver.INSTANCE, mappingContext);
        converter.setCustomConversions(conversions);
        converter.afterPropertiesSet();
        Document document = new Document();
        converter.write(event, document);
        return document;
    }
}
