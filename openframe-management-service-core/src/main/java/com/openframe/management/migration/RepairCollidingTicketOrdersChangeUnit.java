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

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Gives every ticket a rank unique within its {@code statusId} column.
 *
 * Colliding ranks cost drag and drop: LexoRank throws rather than rank between two equal values,
 * so the drop is refused. (Listing is unaffected — the cursor sort tie-breaks on {@code _id}.)
 * The ticket domain now prevents new collisions, but does not repair rows already written.
 *
 * <p>Unlike {@link NormalizeTicketOrderByStatusIdChangeUnit}, which reset every column to
 * createdAt-desc and so discarded manual drag ordering, this preserves the order the board
 * currently shows: each column is read in its rendered order and re-ranked into that sequence.
 *
 * <p>A second pass is needed because {@code normalize-ticket-order-by-status-id} (order 004) is
 * already recorded as executed, and the collisions came back through transitions.
 */
@Slf4j
@ChangeUnit(id = "repair-colliding-ticket-orders", order = "012", author = "openframe")
public class RepairCollidingTicketOrdersChangeUnit {

    private static final String TENANT_ID_FIELD = "tenantId";
    private static final String STATUS_ID_FIELD = "statusId";
    private static final String ORDER_FIELD = "order";
    private static final String CREATED_AT_FIELD = "createdAt";
    private static final String ID_FIELD = "_id";

    @Execution
    public void execution(MongoTemplate mongoTemplate, TenantIdProvider tenantIdProvider) {
        String tenantId = tenantIdProvider.getTenantId();
        List<String> statusIds = distinctStatusIds(mongoTemplate, tenantId);
        log.info("Repair colliding ticket order: {} statusId column(s)", statusIds.size());
        for (String statusId : statusIds) {
            repairColumn(mongoTemplate, statusId, tenantId);
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

    private void repairColumn(MongoTemplate mongoTemplate, String statusId, String tenantId) {
        Query query = new Query(Criteria.where(TENANT_ID_FIELD).is(tenantId)
                .and(STATUS_ID_FIELD).is(statusId));
        // The board's own sort, so a healthy column keeps the exact sequence it is showing.
        query.with(Sort.by(Sort.Direction.ASC, ORDER_FIELD)
                .and(Sort.by(Sort.Direction.DESC, CREATED_AT_FIELD))
                .and(Sort.by(Sort.Direction.DESC, ID_FIELD)));
        List<Ticket> tickets = mongoTemplate.find(query, Ticket.class);

        if (!hasCollision(tickets)) {
            log.info("No colliding order in statusId {} ({} tickets), left as is", statusId, tickets.size());
            return;
        }

        LexoRank rank = LexoRank.middle();
        for (Ticket ticket : tickets) {
            assignOrder(mongoTemplate, ticket.getId(), rank.format());
            rank = rank.genNext();
        }
        log.info("Re-ranked {} tickets in statusId {}", tickets.size(), statusId);
    }

    /** A missing order counts: it sorts as one more value indistinguishable from the next. */
    private boolean hasCollision(List<Ticket> tickets) {
        Set<String> seen = new HashSet<>();
        for (Ticket ticket : tickets) {
            if (ticket.getOrder() == null || !seen.add(ticket.getOrder())) {
                return true;
            }
        }
        return false;
    }

    private void assignOrder(MongoTemplate mongoTemplate, String ticketId, String order) {
        Query byId = new Query(Criteria.where(ID_FIELD).is(ticketId));
        Update update = new Update().set(ORDER_FIELD, order);
        mongoTemplate.updateFirst(byId, update, Ticket.class);
    }
}
