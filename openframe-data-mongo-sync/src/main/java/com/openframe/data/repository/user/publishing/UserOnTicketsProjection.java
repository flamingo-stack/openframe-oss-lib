package com.openframe.data.repository.user.publishing;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.user.User;
import com.openframe.data.repository.ticket.TicketProjectionRepository;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.publishing.api.model.PublishedRecord;
import com.openframe.publishing.api.model.ReconciliationResult;
import com.openframe.publishing.api.model.ReconciliationResult.Mismatch;
import com.openframe.publishing.api.spec.Projection;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

// The user name every ticket keeps for its assignee (assignedName) and its resolver (resolvedByName); TicketCascadeAspect
// writes both until the mode is events.
@Slf4j
@Component
@RequiredArgsConstructor
public class UserOnTicketsProjection implements Projection<UserEvent, TicketUserView> {

    private static final String NAME = "user-on-tickets";

    private final TicketProjectionRepository ticketProjectionRepository;
    private final UserRepository userRepository;

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public void apply(PublishedRecord<UserEvent> record) {
        String tenantId = record.getTenantId();
        UserEvent event = record.getEvent();
        String userId = event.getUserId();
        String fullName = event.fullName();
        long updated = ticketProjectionRepository.updateUserNames(tenantId, userId, fullName);
        log.debug("{} set the name of user {} on {} ticket copies of tenant {}", NAME, userId, updated, tenantId);
    }

    @Override
    public long countChanges(PublishedRecord<UserEvent> record, int limit) {
        String tenantId = record.getTenantId();
        UserEvent event = record.getEvent();
        String userId = event.getUserId();
        String fullName = event.fullName();
        return ticketProjectionRepository.countTicketsToUpdateUserName(tenantId, userId, fullName, limit);
    }

    @Override
    public String applyBatch(PublishedRecord<UserEvent> record, String lastId, int batchSize) {
        String tenantId = record.getTenantId();
        UserEvent event = record.getEvent();
        String userId = event.getUserId();
        String fullName = event.fullName();
        return ticketProjectionRepository.updateUserNamesBatch(tenantId, userId, fullName, lastId, batchSize);
    }

    @Override
    public Class<Ticket> projectedClass() {
        return Ticket.class;
    }

    @Override
    public Class<TicketUserView> projectedViewClass() {
        return TicketUserView.class;
    }

    @Override
    public ReconciliationResult reconcile(List<TicketUserView> projectedItems) {
        List<TicketUserView> withUser = projectedItems.stream()
            .filter(ticket -> ticket.getAssignedTo() != null || ticket.getResolvedById() != null)
            .toList();

        if (withUser.isEmpty()) {
            return ReconciliationResult.allMatch();
        }

        Set<String> tenantIds = new HashSet<>();
        Set<String> userIds = new HashSet<>();
        for (TicketUserView ticket : withUser) {
            tenantIds.add(ticket.getTenantId());
            userIds.add(ticket.getAssignedTo());
            userIds.add(ticket.getResolvedById());
        }
        userIds.remove(null);
        Map<TenantUser, String> names = findFullNames(tenantIds, userIds);

        List<Mismatch> mismatches = withUser.stream()
            .map(ticket -> toMismatch(ticket, names))
            .filter(Objects::nonNull)
            .toList();
        return new ReconciliationResult(mismatches);
    }

    // The assignee's copy first; null when both copies match their users.
    private static Mismatch toMismatch(TicketUserView ticket, Map<TenantUser, String> names) {
        String tenantId = ticket.getTenantId();
        String ticketId = ticket.getId();
        String assignedTo = ticket.getAssignedTo();
        if (assignedTo != null) {
            String assignedName = ticket.getAssignedName();
            Mismatch assignee = toMismatch(tenantId, ticketId, assignedTo, assignedName, names);
            if (assignee != null) {
                return assignee;
            }
        }
        String resolvedById = ticket.getResolvedById();
        if (resolvedById == null) {
            return null;
        }
        String resolvedByName = ticket.getResolvedByName();
        return toMismatch(tenantId, ticketId, resolvedById, resolvedByName, names);
    }

    // The current full names of the batch's users, in one query; a userId is unique only inside its tenant.
    private Map<TenantUser, String> findFullNames(Set<String> tenantIds, Set<String> userIds) {
        Map<TenantUser, String> names = new HashMap<>();
        for (User user : userRepository.findByTenantIdInAndIdIn(tenantIds, userIds)) {
            String tenantId = user.getTenantId();
            String userId = user.getId();
            String firstName = user.getFirstName();
            String lastName = user.getLastName();
            TenantUser key = new TenantUser(tenantId, userId);
            String fullName = UserEvent.fullName(firstName, lastName);
            names.put(key, fullName);
        }
        return names;
    }

    // Null when the copy matches its user.
    private static Mismatch toMismatch(String tenantId, String ticketId, String userId, String copiedName,
                                       Map<TenantUser, String> names) {
        TenantUser key = new TenantUser(tenantId, userId);
        if (!names.containsKey(key)) {
            return new Mismatch(tenantId, ticketId, "user " + userId + " is gone");
        }
        String sourceName = names.get(key);
        if (Objects.equals(sourceName, copiedName)) {
            return null;
        }
        return new Mismatch(tenantId, ticketId, "name \"" + copiedName + "\" differs from user's \"" + sourceName + "\"");
    }

    // A tenant's user: a userId is unique only inside its tenant.
    @Getter
    @EqualsAndHashCode
    @AllArgsConstructor
    private static final class TenantUser {

        private final String tenantId;
        private final String userId;
    }
}
