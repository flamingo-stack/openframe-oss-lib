package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.*;
import graphql.schema.DataFetchingFieldSelectionSet;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.notification.NotificationFilter;
import com.openframe.api.dto.notification.NotificationEntityFilterInput;
import com.openframe.api.dto.notification.NotificationFilterInput;
import com.openframe.api.dto.notification.NotificationRecipient;
import com.openframe.api.dto.notification.NotificationView;
import com.openframe.api.dto.notification.UnreadCategoryCount;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.GraphQLNotificationMapper;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.api.service.NotificationRecipientResolver;
import com.openframe.api.service.NotificationService;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationEntityType;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.notification.readstate.NotificationReadStateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;
import java.util.Map;

import static com.openframe.graphql.relay.NodeType.NOTIFICATION;
import static org.apache.commons.lang3.StringUtils.isBlank;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
public class NotificationDataFetcher {

    private static final String FILTERED_COUNT_FIELD = "filteredCount";

    private final NotificationService notificationService;
    private final NotificationReadStateService readStateService;
    private final GraphQLNotificationMapper notificationMapper;
    private final RelayIdCodec relayIdCodec;
    private final NotificationRecipientResolver recipientResolver;

    @PreAuthorize("hasAnyAuthority('ADMIN', 'AGENT')")
    @DgsQuery
    public CountedGenericConnection<GenericEdge<NotificationView>> notifications(
            @InputArgument NotificationFilterInput filter,
            @InputArgument String search,
            @InputArgument Integer first,
            @InputArgument String after,
            @InputArgument Integer last,
            @InputArgument String before,
            @InputArgument SortInput sort,
            DgsDataFetchingEnvironment dfe) {

        NotificationRecipient r = recipientResolver.current();
        log.debug("Listing notifications for {} {} (filter={}, search={}, sort={})",
                r.type(), r.id(), filter, search, sort);

        ConnectionArgs args = ConnectionArgs.builder()
                .first(first).after(after).last(last).before(before)
                .build();
        CursorPaginationCriteria pagination = notificationMapper.toCursorPaginationCriteria(args);
        NotificationFilter serviceFilter = toServiceFilter(filter, search);

        boolean countRequested = wantsFilteredCount(dfe);
        CountedGenericQueryResult<NotificationView> result = notificationService.list(
                r.id(), r.type(), serviceFilter, pagination, sort, countRequested);
        return notificationMapper.toConnection(result);
    }

    private static boolean wantsFilteredCount(DgsDataFetchingEnvironment dfe) {
        DataFetchingFieldSelectionSet selectionSet = dfe != null ? dfe.getSelectionSet() : null;
        return selectionSet == null || selectionSet.contains(FILTERED_COUNT_FIELD);
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'AGENT')")
    @DgsQuery
    public boolean hasUnreadNotifications() {
        NotificationRecipient r = recipientResolver.current();
        return readStateService.hasUnread(r.id(), r.type());
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'AGENT')")
    @DgsQuery
    public List<UnreadCategoryCount> unreadCountsByCategory() {
        NotificationRecipient r = recipientResolver.current();
        String recipientId = r.id();
        RecipientType recipientType = r.type();
        Map<NotificationCategory, Long> counts = readStateService.unreadCountsByCategory(recipientId, recipientType);
        return notificationMapper.toCategoryCounts(counts);
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'AGENT')")
    @DgsMutation
    public long markNotificationsReadForEntity(@InputArgument NotificationEntityType entityType,
                                               @InputArgument String entityId) {
        NotificationRecipient r = recipientResolver.current();
        return readStateService.markEntityAsRead(r.id(), r.type(), entityType, entityId);
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'AGENT')")
    @DgsMutation
    public boolean markNotificationAsRead(@InputArgument String notificationId) {
        NotificationRecipient r = recipientResolver.current();
        String recipientId = r.id();
        RecipientType recipientType = r.type();
        String rawNotificationId = decodeNotificationId(notificationId);
        return readStateService.markRead(recipientId, recipientType, rawNotificationId);
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'AGENT')")
    @DgsMutation
    public long markAllNotificationsAsRead() {
        NotificationRecipient r = recipientResolver.current();
        return readStateService.markAllAsRead(r.id(), r.type());
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'AGENT')")
    @DgsMutation
    public boolean deleteNotification(@InputArgument String notificationId) {
        NotificationRecipient r = recipientResolver.current();
        String recipientId = r.id();
        RecipientType recipientType = r.type();
        String rawNotificationId = decodeNotificationId(notificationId);
        return readStateService.deleteNotification(recipientId, recipientType, rawNotificationId);
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'AGENT')")
    @DgsMutation
    public long deleteAllReadNotifications() {
        NotificationRecipient r = recipientResolver.current();
        return readStateService.deleteAllRead(r.id(), r.type());
    }

    private static NotificationFilter toServiceFilter(NotificationFilterInput filter, String search) {
        if (filter == null) {
            return new NotificationFilter(null, null, null, null, search);
        }
        NotificationEntityFilterInput entity = filter.getEntity();
        if (entity != null && isBlank(entity.getId())) {
            throw new IllegalArgumentException("filter.entity.id must not be blank");
        }
        return new NotificationFilter(filter.getRead(), filter.getCategories(), filter.getTypes(),
                filter.getSeverities(), search,
                entity == null ? null : entity.getType(),
                entity == null ? null : entity.getId());
    }

    private String decodeNotificationId(String input) {
        if (isBlank(input)) {
            throw new IllegalArgumentException("notificationId must not be blank");
        }
        return relayIdCodec.decode(input, NOTIFICATION);
    }
}
