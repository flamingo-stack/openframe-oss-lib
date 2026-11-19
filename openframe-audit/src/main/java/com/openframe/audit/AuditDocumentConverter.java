package com.openframe.audit;

import org.bson.Document;
import org.springframework.data.mongodb.core.convert.DefaultMongoTypeMapper;
import org.springframework.data.mongodb.core.convert.MappingMongoConverter;
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.data.mongodb.core.convert.NoOpDbRefResolver;
import org.springframework.data.mongodb.core.mapping.MongoPersistentEntity;
import org.springframework.data.mongodb.core.mapping.MongoPersistentProperty;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class AuditDocumentConverter {

    private final MappingMongoConverter converter;

    public AuditDocumentConverter(MongoConverter mongoConverter) {
        converter = new MappingMongoConverter(NoOpDbRefResolver.INSTANCE, mongoConverter.getMappingContext());
        converter.setCustomConversions(mongoConverter.getCustomConversions());
        converter.setTypeMapper(new DefaultMongoTypeMapper(null));
        converter.afterPropertiesSet();
    }

    public Document toDocument(Object record) {
        Document fields = new Document();
        converter.write(record, fields);
        return fields;
    }

    public String versionFieldOf(Object record) {
        return Optional.ofNullable(converter.getMappingContext().getPersistentEntity(record.getClass()))
                .map(MongoPersistentEntity::getVersionProperty)
                .map(MongoPersistentProperty::getFieldName)
                .orElse(null);
    }
}
