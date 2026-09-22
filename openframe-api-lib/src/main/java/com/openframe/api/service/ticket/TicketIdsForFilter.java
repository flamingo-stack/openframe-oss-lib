package com.openframe.api.service.ticket;

import com.openframe.api.dto.ticket.TicketFilterInput;
import com.openframe.data.document.notification.NotificationEntityType;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.repository.notification.EntityCount;
import com.openframe.data.repository.notification.NotificationReadStateRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

import static com.openframe.api.util.AuthPrincipalUtils.isAgent;
import static org.springframework.util.CollectionUtils.isEmpty;

@Component
@RequiredArgsConstructor
public class TicketIdsForFilter {

    private final TicketTagService ticketTagService;
    private final NotificationReadStateRepository readStateRepository;
    private final TenantIdProvider tenantIdProvider;

    // null means "no restriction at all"; an empty list means "nothing matches" — the two are opposite
    // outcomes downstream, so a filter that applied and found nothing must not collapse to null.
    public List<String> resolve(AuthPrincipal principal, TicketFilterInput filter) {
        List<String> restricted = null;
        if (hasTagFilter(filter)) {
            restricted = taggedTicketIds(filter);
        }
        if (isUnreadOnly(filter)) {
            List<String> unread = unreadTicketIds(principal);
            restricted = restricted == null ? unread : intersect(restricted, unread);
        }
        return restricted;
    }

    private boolean hasTagFilter(TicketFilterInput filter) {
        if (filter == null) {
            return false;
        }
        List<String> tagIds = filter.getTagIds();
        return !isEmpty(tagIds);
    }

    private boolean isUnreadOnly(TicketFilterInput filter) {
        if (filter == null) {
            return false;
        }
        Boolean hasUnread = filter.getHasUnreadNotifications();
        return Boolean.TRUE.equals(hasUnread);
    }

    private List<String> taggedTicketIds(TicketFilterInput filter) {
        List<String> tagIds = filter.getTagIds();
        return ticketTagService.getTicketIdsByTagIds(tagIds);
    }

    // An AGENT's read-state rows are keyed by machine id, not user id.
    private List<String> unreadTicketIds(AuthPrincipal principal) {
        boolean agent = isAgent(principal);
        String recipientId = agent ? principal.getMachineId() : principal.getId();
        RecipientType recipientType = agent ? RecipientType.MACHINE : RecipientType.USER;
        String tenantId = tenantIdProvider.getTenantId();
        List<EntityCount> rows = readStateRepository.unreadCountsByEntity(
                recipientId, recipientType, NotificationEntityType.TICKET, tenantId);
        return rows.stream().map(EntityCount::entityId).filter(Objects::nonNull).toList();
    }

    private List<String> intersect(List<String> left, List<String> right) {
        Set<String> retained = new HashSet<>(right);
        return left.stream().filter(retained::contains).toList();
    }
}
