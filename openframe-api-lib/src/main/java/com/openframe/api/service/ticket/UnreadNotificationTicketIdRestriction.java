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

import java.util.List;
import java.util.Objects;

import static com.openframe.api.util.AuthPrincipalUtils.isAgent;

@Component
@RequiredArgsConstructor
public class UnreadNotificationTicketIdRestriction implements TicketIdRestriction {

    private final NotificationReadStateRepository readStateRepository;
    private final TenantIdProvider tenantIdProvider;

    @Override
    public boolean isApplicable(TicketFilterInput filter) {
        if (filter == null) {
            return false;
        }
        Boolean hasUnread = filter.getHasUnreadNotifications();
        return Boolean.TRUE.equals(hasUnread);
    }

    // An AGENT's read-state rows are keyed by machine id, not user id.
    @Override
    public List<String> ticketIds(AuthPrincipal principal, TicketFilterInput filter) {
        boolean agent = isAgent(principal);
        String recipientId = agent ? principal.getMachineId() : principal.getId();
        RecipientType recipientType = agent ? RecipientType.MACHINE : RecipientType.USER;
        String tenantId = tenantIdProvider.getTenantId();
        List<EntityCount> rows = readStateRepository.unreadCountsByEntity(
                recipientId, recipientType, NotificationEntityType.TICKET, tenantId);
        return rows.stream().map(EntityCount::entityId).filter(Objects::nonNull).toList();
    }
}
