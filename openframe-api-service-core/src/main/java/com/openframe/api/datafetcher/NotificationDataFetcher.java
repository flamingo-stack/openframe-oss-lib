package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.*;
import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.notification.NotificationFilter;
import com.openframe.api.dto.notification.NotificationFilterInput;
import com.openframe.api.dto.notification.NotificationView;
import com.openframe.data.document.notification.MachineRecipient;
import com.openframe.data.document.notification.Recipient;
import com.openframe.data.document.notification.UserRecipient;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.mapper.GraphQLNotificationMapper;
import com.openframe.api.service.NotificationService;
import com.openframe.core.exception.UnauthorizedException;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import graphql.relay.Relay;
import jakarta.annotation.Nullable;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.validation.annotation.Validated;

import static org.apache.commons.lang3.StringUtils.isBlank;
import static org.apache.commons.lang3.StringUtils.isNotBlank;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
@Validated
public class NotificationDataFetcher {

    private static final Relay RELAY = new Relay();

    private final NotificationService notificationService;
    private final GraphQLNotificationMapper notificationMapper;

    @DgsData(parentType = "Notification", field = "id")
    public String notificationNodeId(DgsDataFetchingEnvironment dfe) {
        NotificationView view = dfe.getSource();
        return RELAY.toGlobalId("Notification", view.getId());
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'AGENT')")
    @DgsQuery
    public GenericConnection<GenericEdge<NotificationView>> notifications(
            @InputArgument @Nullable String machineId,
            @InputArgument NotificationFilterInput filter,
            @InputArgument Integer first,
            @InputArgument String after,
            @InputArgument Integer last,
            @InputArgument String before) {

        Recipient recipient = resolveRecipient(machineId);
        log.debug("Listing notifications for {} (filter={}, first={}, after={}, last={}, before={})",
                recipient, filter, first, after, last, before);

        ConnectionArgs args = ConnectionArgs.builder()
                .first(first).after(after).last(last).before(before)
                .build();
        CursorPaginationCriteria pagination = notificationMapper.toCursorPaginationCriteria(args);
        NotificationFilter serviceFilter = filter == null
                ? null
                : new NotificationFilter(filter.getRead());

        GenericQueryResult<NotificationView> result = notificationService.list(
                recipient, serviceFilter, pagination);
        return notificationMapper.toConnection(result);
    }

    @PreAuthorize("hasAuthority('ADMIN')")
    @DgsQuery
    public boolean hasUnreadNotifications() {
        String userId = currentUserId();
        return notificationService.hasUnread(userId);
    }

    @PreAuthorize("hasAuthority('ADMIN')")
    @DgsMutation
    public boolean markNotificationAsRead(@InputArgument String notificationId) {
        String userId = currentUserId();
        String rawId = decodeNotificationId(notificationId);
        log.debug("Marking notification {} as read for user {}", rawId, userId);
        return notificationService.markRead(userId, rawId);
    }

    private Recipient resolveRecipient(@Nullable String machineIdArg) {
        AuthPrincipal principal = currentPrincipal();
        if (principal.getActorType() == ActorType.AGENT) {
            String agentMachineId = principal.getMachineId();
            if (isBlank(agentMachineId)) {
                throw new UnauthorizedException("AGENT principal missing machine_id claim");
            }
            if (isNotBlank(machineIdArg) && !machineIdArg.equals(agentMachineId)) {
                throw new UnauthorizedException("AGENT cannot read another machine's notifications");
            }
            return new MachineRecipient(agentMachineId);
        }
        if (isNotBlank(machineIdArg)) {
            return new MachineRecipient(machineIdArg);
        }
        return new UserRecipient(requireUserId(principal));
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

    private String currentUserId() {
        return requireUserId(currentPrincipal());
    }

    private static String requireUserId(AuthPrincipal principal) {
        String id = principal.getId();
        if (isBlank(id)) {
            throw new UnauthorizedException("Authenticated user is required to access notifications");
        }
        return id;
    }

    private AuthPrincipal currentPrincipal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken jwtAuth) {
            return AuthPrincipal.fromJwt(jwtAuth.getToken());
        }
        throw new UnauthorizedException("Authenticated principal is required to access notifications");
    }
}
