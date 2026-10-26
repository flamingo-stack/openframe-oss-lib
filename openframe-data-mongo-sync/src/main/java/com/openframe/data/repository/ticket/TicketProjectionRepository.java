package com.openframe.data.repository.ticket;

import com.mongodb.ReadPreference;
import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.ticket.Ticket;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

import java.util.List;

// The projections' ticket writes. Not TicketRepository: that one is tenant-aware and not created in the shared stream,
// where the projections run, so every write here names its tenant.
@Repository
@RequiredArgsConstructor
public class TicketProjectionRepository {

    private static final String FIELD_ID = "id";
    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_ORGANIZATION_ID = "organizationId";
    private static final String FIELD_ORGANIZATION_NAME = "organizationName";

    private final MongoOperations mongoOperations;

    // Only tickets with another name change; Ticket.class makes Spring add $inc on @Version, so a stale copy fails to save.
    public long updateOrganizationName(String tenantId, String organizationId, String organizationName) {
        Criteria outdatedCopies = outdatedOrganizationNames(tenantId, organizationId, organizationName);
        Query query = new Query(outdatedCopies);
        Update update = new Update().set(FIELD_ORGANIZATION_NAME, organizationName);
        UpdateResult result = mongoOperations.updateMulti(query, update, Ticket.class);
        return result.getModifiedCount();
    }

    public long countOutdatedOrganizationNames(String tenantId, String organizationId, String organizationName, int limit) {
        Criteria outdatedCopies = outdatedOrganizationNames(tenantId, organizationId, organizationName);
        Query query = new Query(outdatedCopies).limit(limit);
        return mongoOperations.count(query, Ticket.class);
    }

    // One batch in _id order after lastId (null for the first); returns its last _id, or null when no outdated ticket is left.
    public String updateOrganizationNameBatch(String tenantId, String organizationId, String organizationName, String lastId,
                                              int batchSize) {
        Criteria nextOutdatedCopies = outdatedOrganizationNames(tenantId, organizationId, organizationName);
        if (lastId != null) {
            nextOutdatedCopies.and(FIELD_ID).gt(lastId);
        }
        Query batchQuery = new Query(nextOutdatedCopies).with(Sort.by(FIELD_ID)).limit(batchSize);
        batchQuery.fields().include(FIELD_ID);
        List<String> batchIds = mongoOperations.find(batchQuery, Ticket.class).stream()
                .map(Ticket::getId)
                .toList();
        if (batchIds.isEmpty()) {
            return null;
        }

        Criteria batchCopies = outdatedOrganizationNames(tenantId, organizationId, organizationName)
                .and(FIELD_ID).in(batchIds);
        Query updateQuery = new Query(batchCopies);
        Update update = new Update().set(FIELD_ORGANIZATION_NAME, organizationName);
        mongoOperations.updateMulti(updateQuery, update, Ticket.class);
        return batchIds.getLast();
    }

    private static Criteria outdatedOrganizationNames(String tenantId, String organizationId, String organizationName) {
        return Criteria.where(FIELD_TENANT_ID).is(tenantId)
                .and(FIELD_ORGANIZATION_ID).is(organizationId)
                .and(FIELD_ORGANIZATION_NAME).ne(organizationName);
    }
}
