package com.openframe.event.jobs.repository;

import com.mongodb.ReadPreference;
import com.openframe.event.jobs.reconciliation.MappedCopy;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.publishing.api.PublishedDocuments.ID_FIELD;

// Reads the two sides of a copy by collection and field names, so one class serves every copy.
public class ReconciledCopyRepository {

    public static final String TENANT_FIELD = "tenantId";

    private static final ReadPreference PRIMARY = ReadPreference.primary();

    private final MongoOperations mongoOperations;

    public ReconciledCopyRepository(MongoOperations mongoOperations) {
        this.mongoOperations = mongoOperations;
    }

    // The next target rows in _id order, with only the fields the comparison needs; a secondary's lag is checked again later.
    public List<Document> findTargetsAfter(MappedCopy copy, String lastId, int limit) {
        Sort byId = Sort.by(Sort.Direction.ASC, ID_FIELD);
        Query query = new Query().with(byId).limit(limit);
        if (lastId != null) {
            Object lastIdValue = idValueOf(lastId);
            Criteria afterLastId = Criteria.where(ID_FIELD).gt(lastIdValue);
            query.addCriteria(afterLastId);
        }
        includeTargetFields(copy, query);
        String collection = copy.getTargetCollection();
        return mongoOperations.find(query, Document.class, collection);
    }

    // The rows that looked wrong, read again from the primary.
    public List<Document> findTargetsByIds(MappedCopy copy, Collection<String> ids) {
        List<Object> idValues = new ArrayList<>();
        for (String id : ids) {
            Object idValue = idValueOf(id);
            idValues.add(idValue);
        }
        Criteria idIn = Criteria.where(ID_FIELD).in(idValues);
        Query query = Query.query(idIn);
        query.withReadPreference(PRIMARY);
        includeTargetFields(copy, query);
        String collection = copy.getTargetCollection();
        return mongoOperations.find(query, Document.class, collection);
    }

    // One query per batch, from the primary: tenant -> key -> value; no source means no key, a source without the field null.
    public Map<String, Map<String, Object>> findSourceValues(MappedCopy copy, Collection<String> tenantIds,
                                                            Collection<String> keys) {
        String keyField = copy.getSourceKeyField();
        String valueField = copy.getSourceField();
        Criteria ofTenants = Criteria.where(TENANT_FIELD).in(tenantIds).and(keyField).in(keys);
        Query query = new Query(ofTenants);
        query.withReadPreference(PRIMARY);
        query.fields().include(TENANT_FIELD, keyField, valueField);
        String collection = copy.getSourceCollection();
        List<Document> sources = mongoOperations.find(query, Document.class, collection);
        Map<String, Map<String, Object>> valuesByTenant = new HashMap<>();
        for (Document source : sources) {
            String tenantId = source.getString(TENANT_FIELD);
            String key = source.getString(keyField);
            Object value = source.get(valueField);
            valuesByTenant.computeIfAbsent(tenantId, tenant -> new HashMap<>()).put(key, value);
        }
        return valuesByTenant;
    }

    public boolean targetCollectionExists(MappedCopy copy) {
        String collection = copy.getTargetCollection();
        return mongoOperations.collectionExists(collection);
    }

    private static void includeTargetFields(MappedCopy copy, Query query) {
        String referenceField = copy.getTargetReferenceField();
        String copiedField = copy.getTargetField();
        query.fields().include(ID_FIELD, TENANT_FIELD, referenceField, copiedField);
    }

    // lastId is kept as a string; Spring stores a valid hex id as an ObjectId, so it is matched as one, as a typed query does.
    private Object idValueOf(String id) {
        MongoConverter converter = mongoOperations.getConverter();
        return converter.convertId(id, ObjectId.class);
    }
}
