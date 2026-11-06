package com.openframe.publishing.registry;

import com.mongodb.ReadPreference;
import com.openframe.publishing.api.OutboxPublisher;
import com.openframe.publishing.api.PublishedDocuments;
import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.config.PublishedAggregateTopics;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import static com.openframe.publishing.api.PublishedDocuments.ID_FIELD;

// What a job around the published events may use, by type: whether it publishes, its ids, and its current state on the outbox.
public class PublishedAggregates {

    private final AggregateSpecRegistry specRegistry;
    private final PublishedAggregateTopics topics;
    private final OutboxPublisher outboxPublisher;
    private static final ReadPreference PRIMARY = ReadPreference.primary();

    private final MongoOperations mongoOperations;
    private final PublishedDocuments documents;

    public PublishedAggregates(AggregateSpecRegistry specRegistry, PublishedAggregateTopics topics,
                               OutboxPublisher outboxPublisher, MongoOperations mongoOperations) {
        this.specRegistry = specRegistry;
        this.topics = topics;
        this.outboxPublisher = outboxPublisher;
        this.mongoOperations = mongoOperations;
        this.documents = new PublishedDocuments(mongoOperations);
    }

    // A spec and publish on: without either, an outbox write would do nothing.
    public boolean isPublishing(String type) {
        return specRegistry.hasSpec(type) && topics.isPublishing(type);
    }

    // Typed by the document class, so a String id is matched as the ObjectId it is stored as.
    public List<String> idsAfter(String type, String lastId, int limit) {
        Class<?> documentClass = documentClassOf(type);
        Sort byId = Sort.by(Sort.Direction.ASC, ID_FIELD);
        Query query = new Query().with(byId).limit(limit);
        if (lastId != null) {
            Criteria afterLastId = Criteria.where(ID_FIELD).gt(lastId);
            query.addCriteria(afterLastId);
        }
        query.fields().include(ID_FIELD);
        List<?> found = mongoOperations.find(query, documentClass);
        return idsOf(found);
    }

    public Map<String, Long> publishCurrent(String type, Collection<String> ids) {
        AggregateSpec<?, ?> spec = specRegistry.specOf(type);
        return outboxPublisher.publishCurrent(spec, ids);
    }

    // The documents written since: read from the primary, so a secondary's lag cannot hide one.
    public List<String> changedSince(String type, Map<String, Long> publishedVersions) {
        Class<?> documentClass = documentClassOf(type);
        Collection<String> ids = publishedVersions.keySet();
        Criteria idIn = Criteria.where(ID_FIELD).in(ids);
        Query query = Query.query(idIn);
        query.withReadPreference(PRIMARY);
        documents.includeDeleteFields(documentClass, query);
        List<?> current = mongoOperations.find(query, documentClass);
        List<String> changed = new ArrayList<>();
        for (Object document : current) {
            String id = documents.idOf(document);
            long version = documents.versionOf(document);
            Long published = publishedVersions.get(id);
            if (published == null || version != published) {
                changed.add(id);
            }
        }
        return changed;
    }

    private Class<?> documentClassOf(String type) {
        AggregateSpec<?, ?> spec = specRegistry.specOf(type);
        return PublishedDocuments.classOf(spec);
    }

    private List<String> idsOf(List<?> found) {
        List<String> ids = new ArrayList<>();
        for (Object document : found) {
            String id = documents.idOf(document);
            ids.add(id);
        }
        return ids;
    }
}
