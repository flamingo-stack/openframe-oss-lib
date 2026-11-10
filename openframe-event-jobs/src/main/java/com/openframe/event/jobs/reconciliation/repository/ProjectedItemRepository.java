package com.openframe.event.jobs.reconciliation.repository;

import com.mongodb.ReadPreference;
import com.openframe.publishing.api.PublishedDocuments;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.Collection;
import java.util.List;

import static com.openframe.publishing.api.PublishedDocuments.ID_FIELD;

// Reads the projected items of any projection: the collection of its document class, only the fields of its view class.
public class ProjectedItemRepository {

    private static final ReadPreference PRIMARY = ReadPreference.primary();

    private final MongoOperations mongoOperations;
    private final PublishedDocuments documents;

    public ProjectedItemRepository(MongoOperations mongoOperations) {
        this.mongoOperations = mongoOperations;
        this.documents = new PublishedDocuments(mongoOperations);
    }

    // The next items in _id order; typed by the document class, a hex lastId matches as an ObjectId. A secondary's lag is checked again later.
    public <T> List<T> findAfter(Class<?> projectedClass, Class<T> projectedViewClass, String lastId, int limit) {
        Sort byId = Sort.by(Sort.Direction.ASC, ID_FIELD);
        Query query = new Query().with(byId).limit(limit);
        if (lastId != null) {
            Criteria afterLastId = Criteria.where(ID_FIELD).gt(lastId);
            query.addCriteria(afterLastId);
        }
        return findItems(projectedClass, projectedViewClass, query);
    }

    // The items that looked wrong, read again from the primary.
    public <T> List<T> findByIds(Class<?> projectedClass, Class<T> projectedViewClass, Collection<String> ids) {
        Criteria idIn = Criteria.where(ID_FIELD).in(ids);
        Query query = Query.query(idIn);
        query.withReadPreference(PRIMARY);
        return findItems(projectedClass, projectedViewClass, query);
    }

    public boolean collectionExists(Class<?> projectedClass) {
        return mongoOperations.collectionExists(projectedClass);
    }

    public String resolveId(Object projectedItem) {
        return documents.idOf(projectedItem);
    }

    // Spring reads only the view class's fields when the result type differs from the document class.
    private <T> List<T> findItems(Class<?> projectedClass, Class<T> projectedViewClass, Query query) {
        return mongoOperations.query(projectedClass)
                .as(projectedViewClass)
                .matching(query)
                .all();
    }
}
