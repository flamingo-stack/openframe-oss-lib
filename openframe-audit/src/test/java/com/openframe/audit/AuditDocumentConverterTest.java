package com.openframe.audit;

import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.convert.WritingConverter;
import org.springframework.data.mongodb.core.convert.MappingMongoConverter;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.convert.NoOpDbRefResolver;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AuditDocumentConverterTest {

    @Test
    void of_nestedValuesOfAnotherClass_writesNoClassKeyAtAnyDepth() {
        Folder folder = new Folder("folder-1", new Person("Anna"), List.of(new Person("Ben")), 3L, null);

        Document fields = documentConverter().toDocument(folder);

        assertThat(fields).isEqualTo(new Document("_id", "folder-1")
                .append("owner", new Document("name", "Anna"))
                .append("watchers", List.of(new Document("name", "Ben")))
                .append("v", 3L));
    }

    @Test
    void of_valueTheServiceConvertsItself_writesItTheServicesWay() {
        Folder folder = new Folder("folder-1", null, List.of(), null, new Money(250, "EUR"));

        Document fields = documentConverter(new MoneyToText()).toDocument(folder);

        assertThat(fields).containsEntry("budget", "250 EUR");
    }

    @Test
    void versionFieldOf_recordWithAVersionCounter_namesTheKeyItIsStoredUnder() {
        Folder folder = new Folder("folder-1", null, List.of(), 3L, null);

        assertThat(documentConverter().versionFieldOf(folder)).isEqualTo("v");
    }

    private static AuditDocumentConverter documentConverter(Converter<?, ?>... conversions) {
        MongoCustomConversions customConversions = new MongoCustomConversions(List.of(conversions));
        MongoMappingContext mappingContext = new MongoMappingContext();
        mappingContext.setSimpleTypeHolder(customConversions.getSimpleTypeHolder());
        MappingMongoConverter serviceConverter = new MappingMongoConverter(NoOpDbRefResolver.INSTANCE, mappingContext);
        serviceConverter.setCustomConversions(customConversions);
        serviceConverter.afterPropertiesSet();
        return new AuditDocumentConverter(serviceConverter);
    }

    record Folder(@Id String id, Object owner, List<Object> watchers, @Version @Field("v") Long version, Money budget) {
    }

    record Person(String name) {
    }

    record Money(int amount, String currency) {
    }

    @WritingConverter
    static class MoneyToText implements Converter<Money, String> {

        @Override
        public String convert(Money money) {
            return money.amount() + " " + money.currency();
        }
    }
}
