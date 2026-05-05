package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.mapper.GraphQLNotificationMapper;
import com.openframe.api.service.NotificationService;
import com.openframe.core.exception.UnauthorizedException;
import com.openframe.data.document.notification.Notification;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import graphql.relay.Relay;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.validation.annotation.Validated;

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
        Notification notification = dfe.getSource();
        return RELAY.toGlobalId("Notification", notification.getId());
    }

    @DgsQuery
    public GenericConnection<GenericEdge<Notification>> notifications(
            @InputArgument Integer first,
            @InputArgument String after,
            @InputArgument Integer last,
            @InputArgument String before) {

        String userId = currentUserId();
        log.debug("Listing notifications for user {} (first={}, after={}, last={}, before={})",
                userId, first, after, last, before);

        ConnectionArgs args = ConnectionArgs.builder()
                .first(first).after(after).last(last).before(before)
                .build();
        CursorPaginationCriteria pagination = notificationMapper.toCursorPaginationCriteria(args);

        GenericQueryResult<Notification> result = notificationService.listForRecipient(userId, pagination);
        return notificationMapper.toConnection(result);
    }

    @DgsQuery
    public boolean hasUnreadNotifications() {
        String userId = currentUserId();
        return notificationService.hasUnread(userId);
    }

    @DgsQuery
    public GenericConnection<GenericEdge<Notification>> machineNotifications(
            @InputArgument Integer first,
            @InputArgument String after,
            @InputArgument Integer last,
            @InputArgument String before) {

        String machineId = currentMachineId();
        log.debug("Listing notifications for machine {} (first={}, after={}, last={}, before={})",
                machineId, first, after, last, before);

        ConnectionArgs args = ConnectionArgs.builder()
                .first(first).after(after).last(last).before(before)
                .build();
        CursorPaginationCriteria pagination = notificationMapper.toCursorPaginationCriteria(args);

        GenericQueryResult<Notification> result = notificationService.listForMachine(machineId, pagination);
        return notificationMapper.toConnection(result);
    }

    @DgsMutation
    public boolean markNotificationAsRead(@InputArgument String notificationId) {
        String userId = currentUserId();
        String rawId = decodeNotificationId(notificationId);
        log.debug("Marking notification {} as read for user {}", rawId, userId);
        return notificationService.markRead(userId, rawId);
    }

    /** Strict — silently resolving a malformed id to {@code false} hides client bugs. */
    private String decodeNotificationId(String input) {
        if (input == null || input.isBlank()) {
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
        AuthPrincipal principal = currentPrincipal();
        String id = principal.getId();
        if (id == null || id.isBlank()) {
            throw new UnauthorizedException("Authenticated user is required to access notifications");
        }
        return id;
    }

    /** AGENT principals only — admin tokens can't reach a machine's backlog. */
    private String currentMachineId() {
        AuthPrincipal principal = currentPrincipal();
        if (principal.getActorType() != ActorType.AGENT) {
            throw new UnauthorizedException("AGENT principal is required to access machine notifications");
        }
        String machineId = principal.getMachineId();
        if (machineId == null || machineId.isBlank()) {
            throw new UnauthorizedException("AGENT principal missing machine_id claim");
        }
        return machineId;
    }

    private AuthPrincipal currentPrincipal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken jwtAuth) {
            return AuthPrincipal.fromJwt(jwtAuth.getToken());
        }
        throw new UnauthorizedException("Authenticated principal is required to access notifications");
    }
}
