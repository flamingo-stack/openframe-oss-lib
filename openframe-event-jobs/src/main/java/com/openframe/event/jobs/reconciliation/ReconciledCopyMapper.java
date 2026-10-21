package com.openframe.event.jobs.reconciliation;

import org.springframework.data.mapping.context.MappingContext;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.data.mongodb.core.mapping.MongoPersistentEntity;
import org.springframework.data.mongodb.core.mapping.MongoPersistentProperty;

import java.util.function.UnaryOperator;

import static com.openframe.event.jobs.repository.ReconciledCopyRepository.TENANT_FIELD;

// Resolves a copy's classes and properties to collections and stored field names, so a typo fails at startup.
public class ReconciledCopyMapper {

    private static final String TENANT_PROPERTY = "tenantId";

    private final MappingContext<? extends MongoPersistentEntity<?>, MongoPersistentProperty> mappingContext;

    public ReconciledCopyMapper(MongoOperations mongoOperations) {
        MongoConverter converter = mongoOperations.getConverter();
        this.mappingContext = converter.getMappingContext();
    }

    public MappedCopy toMappedCopy(ReconciledCopy copy) {
        String name = copy.getName();
        Class<?> targetClass = copy.getTargetClass();
        Class<?> sourceClass = copy.getSourceClass();
        MongoPersistentEntity<?> target = mappingContext.getRequiredPersistentEntity(targetClass);
        MongoPersistentEntity<?> source = mappingContext.getRequiredPersistentEntity(sourceClass);
        requireTenantField(name, target);
        requireTenantField(name, source);
        String targetReferenceProperty = copy.getTargetReferenceProperty();
        String targetProperty = copy.getTargetProperty();
        String sourceKeyProperty = copy.getSourceKeyProperty();
        String sourceProperty = copy.getSourceProperty();
        String targetReferenceField = fieldOf(name, target, targetReferenceProperty);
        String targetField = fieldOf(name, target, targetProperty);
        String sourceKeyField = fieldOf(name, source, sourceKeyProperty);
        String sourceField = fieldOf(name, source, sourceProperty);
        String targetCollection = target.getCollection();
        String sourceCollection = source.getCollection();
        UnaryOperator<Object> expectedCopy = copy.getExpectedCopy();
        return MappedCopy.builder()
                .name(name)
                .targetCollection(targetCollection)
                .targetReferenceField(targetReferenceField)
                .targetField(targetField)
                .sourceCollection(sourceCollection)
                .sourceKeyField(sourceKeyField)
                .sourceField(sourceField)
                .expectedCopy(expectedCopy)
                .build();
    }

    private static String fieldOf(String copyName, MongoPersistentEntity<?> entity, String property) {
        MongoPersistentProperty persistentProperty = entity.getPersistentProperty(property);
        if (persistentProperty == null) {
            String entityName = entity.getName();
            throw new IllegalStateException("Reconciled copy " + copyName + ": " + entityName + " has no property " + property);
        }
        return persistentProperty.getFieldName();
    }

    // Both sides are matched by tenant, so both must store it where the repository reads it.
    private static void requireTenantField(String copyName, MongoPersistentEntity<?> entity) {
        String tenantField = fieldOf(copyName, entity, TENANT_PROPERTY);
        if (!TENANT_FIELD.equals(tenantField)) {
            String entityName = entity.getName();
            throw new IllegalStateException("Reconciled copy " + copyName + ": " + entityName + " stores its tenant as " + tenantField);
        }
    }
}
