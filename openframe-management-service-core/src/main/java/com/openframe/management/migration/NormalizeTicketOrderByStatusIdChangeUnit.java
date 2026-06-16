package com.openframe.management.migration;

import com.github.pravin.raha.lexorank4j.LexoRank;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.service.TenantIdProvider;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.List;

/**
 * Repairs ticket ordering for the lifecycle (custom-status) board.
 * <p>
 * Tickets created while the lifecycle feature was enabled but before the order calculation was fixed
 * had their {@code order} computed against the legacy {@code status} column (which is unset on migrated
 * tickets), so they collided around {@link LexoRank#middle()} instead of landing at the top of their
 * {@code statusId} column. This re-ranks every statusId column by {@code createdAt} descending — the same
 * "newest on top" default as {@link BackfillTicketOrdersChangeUnit} — restoring a clean order.
 * <p>
 * Note: this resets any manual drag ordering within a column back to createdAt-desc.
 */
@Slf4j
@ChangeUnit(id = "normalize-ticket-order-by-status-id", order = "004", author = "openframe")
public class NormalizeTicketOrderByStatusIdChangeUnit {

    private static final String TENANT_ID_FIELD = "tenantId";
    private static final String STATUS_ID_FIELD = "statusId";
    private static final String ORDER_FIELD = "order";
    private static final String CREATED_AT_FIELD = "createdAt";
    private static final String ID_FIELD = "_id";

    @Execution
    public void execution(MongoTemplate mongoTemplate, TenantIdProvider tenantIdProvider) {
        String tenantId = tenantIdProvider.getTenantId();
        List<String> statusIds = distinctStatusIds(mongoTemplate, tenantId);
        log.info("Normalize ticket order: {} statusId column(s)", statusIds.size());
        for (String statusId : statusIds) {
            normalizeColumn(mongoTemplate, statusId, tenantId);
        }
    }

    @RollbackExecution
    public void rollback() {
    }

    private List<String> distinctStatusIds(MongoTemplate mongoTemplate, String tenantId) {
        Query query = new Query(Criteria.where(TENANT_ID_FIELD).is(tenantId)
                .and(STATUS_ID_FIELD).ne(null));
        return mongoTemplate.findDistinct(query, STATUS_ID_FIELD, Ticket.class, String.class);
    }

    private void normalizeColumn(MongoTemplate mongoTemplate, String statusId, String tenantId) {
        Query query = new Query(Criteria.where(TENANT_ID_FIELD).is(tenantId)
                .and(STATUS_ID_FIELD).is(statusId));
        query.with(Sort.by(Sort.Direction.DESC, CREATED_AT_FIELD).and(Sort.by(Sort.Direction.DESC, ID_FIELD)));
        List<Ticket> tickets = mongoTemplate.find(query, Ticket.class);

        LexoRank rank = LexoRank.middle();
        for (Ticket ticket : tickets) {
            assignOrder(mongoTemplate, ticket.getId(), rank.format());
            rank = rank.genNext();
        }
        log.info("Normalized order on {} tickets in statusId {}", tickets.size(), statusId);
    }

    private void assignOrder(MongoTemplate mongoTemplate, String ticketId, String order) {
        Query byId = new Query(Criteria.where(ID_FIELD).is(ticketId));
        Update update = new Update().set(ORDER_FIELD, order);
        mongoTemplate.updateFirst(byId, update, Ticket.class);
    }
}
