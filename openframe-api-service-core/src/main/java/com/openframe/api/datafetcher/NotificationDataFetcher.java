package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.*;
import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.notification.NotificationFilter;
import com.openframe.api.dto.notification.NotificationFilterInput;
import com.openframe.api.dto.notification.NotificationView;
import com.openframe.api.dto.notification.UnreadCategoryCount;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.GraphQLNotificationMapper;
import com.openframe.api.service.NotificationService;
import com.openframe.core.exception.UnauthorizedException;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.service.notification.NotificationReadStateService;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import graphql.relay.Relay;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.apache.commons.lang3.StringUtils.isBlank;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
public class NotificationDataFetcher {

    private static final Relay RELAY = new Relay();

    private final NotificationService notificationService;
    private final NotificationReadStateService readStateService;
    private final GraphQLNotificationMapper notificationMapper;

    @DgsData(parentType = "Notification", field = "id")
    public String notificationNodeId(DgsDataFetchingEnvironment dfe) {
        NotificationView view = dfe.getSource();
        return RELAY.toGlobalId("Notification", view.id());
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'AGENT')")
    @DgsQuery
    public GenericConnection<GenericEdge<NotificationView>> notifications(
            @InputArgument NotificationFilterInput filter,
            @InputArgument String search,
            @InputArgument Integer first,
            @InputArgument String after,
            @InputArgument Integer last,
            @InputArgument String before,
            @InputArgument SortInput sort) {

        Recipient r = currentRecipient();
        log.debug("Listing notifications for {} {} (filter={}, search={}, sort={})",
                r.type(), r.id(), filter, search, sort);

        ConnectionArgs args = ConnectionArgs.builder()
                .first(first).after(after).last(last).before(before)
                .build();
        CursorPaginationCriteria pagination = notificationMapper.toCursorPaginationCriteria(args);
        NotificationFilter serviceFilter = new NotificationFilter(
                filter == null ? null : filter.getRead(), search);

        GenericQueryResult<NotificationView> result = notificationService.list(
                r.id(), r.type(), serviceFilter, pagination, sort);
        return notificationMapper.toConnection(result);
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'AGENT')")
    @DgsQuery
    public boolean hasUnreadNotifications() {
        Recipient r = currentRecipient();
        return readStateService.hasUnread(r.id(), r.type());
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'AGENT')")
    @DgsQuery
    public List<UnreadCategoryCount> unreadCountsByCategory() {
        Recipient r = currentRecipient();
        Map<NotificationCategory, Long> counts = readStateService.unreadCountsByCategory(r.id(), r.type());
        List<UnreadCategoryCount> result = new ArrayList<>(counts.size());
        for (Map.Entry<NotificationCategory, Long> entry : counts.entrySet()) {
            result.add(new UnreadCategoryCount(entry.getKey(), entry.getValue()));
        }
        return result;
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'AGENT')")
    @DgsMutation
    public boolean markNotificationAsRead(@InputArgument String notificationId) {
        Recipient r = currentRecipient();
        return readStateService.markRead(r.id(), r.type(), decodeNotificationId(notificationId));
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'AGENT')")
    @DgsMutation
    public long markAllNotificationsAsRead() {
        Recipient r = currentRecipient();
        return readStateService.markAllAsRead(r.id(), r.type());
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'AGENT')")
    @DgsMutation
    public boolean deleteNotification(@InputArgument String notificationId) {
        Recipient r = currentRecipient();
        return readStateService.deleteNotification(r.id(), r.type(), decodeNotificationId(notificationId));
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'AGENT')")
    @DgsMutation
    public long deleteAllReadNotifications() {
        Recipient r = currentRecipient();
        return readStateService.deleteAllRead(r.id(), r.type());
    }

    private record Recipient(String id, RecipientType type) {}

    private Recipient currentRecipient() {
        AuthPrincipal principal = currentPrincipal();
        if (principal.getActorType() == ActorType.AGENT) {
            String machineId = principal.getMachineId();
            if (isBlank(machineId)) {
                throw new UnauthorizedException("AGENT principal missing machine_id claim");
            }
            return new Recipient(machineId, RecipientType.MACHINE);
        }
        String userId = principal.getId();
        if (isBlank(userId)) {
            throw new UnauthorizedException("Authenticated user is required to access notifications");
        }
        return new Recipient(userId, RecipientType.USER);
    }

    private String decodeNotificationId(String input) {
        if (isBlank(input)) {
            throw new IllegalArgumentException("notificationId must not be blank");
        }
        Relay.ResolvedGlobalId resolved;
        try {
            resolved = RELAY.fromGlobalId(input);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid notificationId: " + input, ex);
        }
        if (!"Notification".equals(resolved.getType())) {
            throw new IllegalArgumentException(
                    "notificationId references the wrong type: " + resolved.getType());
        }
        return resolved.getId();
    }

    private AuthPrincipal currentPrincipal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken jwtAuth) {
            return AuthPrincipal.fromJwt(jwtAuth.getToken());
        }
        throw new UnauthorizedException("Notifications require a JWT-authenticated principal; got " +
                (authentication == null ? "no authentication" : authentication.getClass().getSimpleName()));
    }
}
