package com.openframe.publishing.api;

import com.openframe.data.document.TenantScoped;
import org.springframework.core.ResolvableType;
import org.springframework.data.mapping.PersistentPropertyAccessor;
import org.springframework.data.mapping.context.MappingContext;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.mapping.MongoPersistentEntity;
import org.springframework.data.mongodb.core.mapping.MongoPersistentProperty;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.util.ClassUtils;

// What an outbox row takes from a published document, through Spring Data's mapping metadata: class, id, version, tenant.
class PublishedDocuments {

    static final String ID_FIELD = "_id";
    private static final String TENANT_PROPERTY = "tenantId";
    private static final int DOCUMENT_TYPE_ARGUMENT = 0;

    private final MongoOperations mongoOperations;

    PublishedDocuments(MongoOperations mongoOperations) {
        this.mongoOperations = mongoOperations;
    }

    static Class<?> classOf(PublishedAggregateSpec<?, ?> spec) {
        Class<?> specClass = ClassUtils.getUserClass(spec);
        ResolvableType specType = ResolvableType.forClass(specClass).as(PublishedAggregateSpec.class);
        return specType.getGeneric(DOCUMENT_TYPE_ARGUMENT).resolve();
    }

    // Only the fields a tombstone needs: the id, the version and the tenant.
    void includeDeleteFields(Class<?> documentClass, Query query) {
        MongoPersistentEntity<?> entity = entityOf(documentClass);
        String versionField = entity.getRequiredVersionProperty().getFieldName();
        query.fields().include(ID_FIELD, versionField);
        MongoPersistentProperty tenantProperty = entity.getPersistentProperty(TENANT_PROPERTY);
        if (tenantProperty != null) {
            String tenantField = tenantProperty.getFieldName();
            query.fields().include(tenantField);
        }
    }

    Object identifierOf(Object document) {
        Class<?> documentClass = document.getClass();
        MongoPersistentEntity<?> entity = entityOf(documentClass);
        return entity.getIdentifierAccessor(document).getIdentifier();
    }

    String idOf(Object document) {
        Object identifier = identifierOf(document);
        return String.valueOf(identifier);
    }

    // The startup check refuses a published document without @Version.
    long versionOf(Object document) {
        Class<?> documentClass = document.getClass();
        MongoPersistentEntity<?> entity = entityOf(documentClass);
        MongoPersistentProperty versionProperty = entity.getRequiredVersionProperty();
        PersistentPropertyAccessor<Object> accessor = entity.getPropertyAccessor(document);
        Number version = (Number) accessor.getProperty(versionProperty);
        return version == null ? 0 : version.longValue();
    }

    static String tenantOf(Object document) {
        return document instanceof TenantScoped scoped ? scoped.getTenantId() : null;
    }

    private MongoPersistentEntity<?> entityOf(Class<?> documentClass) {
        MappingContext<? extends MongoPersistentEntity<?>, MongoPersistentProperty> context =
                mongoOperations.getConverter().getMappingContext();
        return context.getRequiredPersistentEntity(documentClass);
    }
}
