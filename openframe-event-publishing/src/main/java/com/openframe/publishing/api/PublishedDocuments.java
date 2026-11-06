package com.openframe.publishing.api;

import com.openframe.data.document.TenantScoped;
import com.openframe.publishing.api.spec.AggregateSpec;
import org.springframework.core.ResolvableType;
import org.springframework.data.mapping.PersistentPropertyAccessor;
import org.springframework.data.mapping.context.MappingContext;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.mapping.MongoPersistentEntity;
import org.springframework.data.mongodb.core.mapping.MongoPersistentProperty;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.util.ClassUtils;

// What an outbox row takes from a published document, through Spring Data's mapping metadata: class, id, version, tenant.
public class PublishedDocuments {

    public static final String ID_FIELD = "_id";
    private static final String TENANT_PROPERTY = "tenantId";
    private static final int DOCUMENT_TYPE_ARGUMENT = 0;
    private static final int EVENT_TYPE_ARGUMENT = 1;

    private final MongoOperations mongoOperations;

    public PublishedDocuments(MongoOperations mongoOperations) {
        this.mongoOperations = mongoOperations;
    }

    public static Class<?> classOf(AggregateSpec<?, ?> spec) {
        Class<?> specClass = ClassUtils.getUserClass(spec);
        return classOfSpecClass(specClass);
    }

    // The document class a spec class names, from its type argument; null when the class does not name it.
    public static Class<?> classOfSpecClass(Class<?> specClass) {
        Class<?> userClass = ClassUtils.getUserClass(specClass);
        ResolvableType specType = ResolvableType.forClass(userClass).as(AggregateSpec.class);
        return specType.getGeneric(DOCUMENT_TYPE_ARGUMENT).resolve();
    }

    // The event class a spec names, the class its records are read into.
    public static Class<?> resolveEventClass(AggregateSpec<?, ?> spec) {
        Class<?> specClass = ClassUtils.getUserClass(spec);
        ResolvableType specType = ResolvableType.forClass(specClass).as(AggregateSpec.class);
        return specType.getGeneric(EVENT_TYPE_ARGUMENT).resolve();
    }

    // Only the fields a tombstone needs: the id, the version and the tenant.
    public void includeDeleteFields(Class<?> documentClass, Query query) {
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

    public String idOf(Object document) {
        Object identifier = identifierOf(document);
        return String.valueOf(identifier);
    }

    // The startup check refuses a published document without @Version.
    public long versionOf(Object document) {
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
