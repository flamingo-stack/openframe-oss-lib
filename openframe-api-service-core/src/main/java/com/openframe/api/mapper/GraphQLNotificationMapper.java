package com.openframe.api.mapper;

import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.notification.NotificationView;
import com.openframe.api.dto.notification.UnreadCategoryCount;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class GraphQLNotificationMapper {

    public CursorPaginationCriteria toCursorPaginationCriteria(ConnectionArgs args) {
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    public List<UnreadCategoryCount> toCategoryCounts(Map<NotificationCategory, Long> counts) {
        return counts.entrySet().stream()
                .map(entry -> new UnreadCategoryCount(entry.getKey(), entry.getValue()))
                .toList();
    }

    public NotificationView toView(Notification notification, boolean read) {
        NotificationCategory category = notification.getCategory();
        return NotificationView.builder()
                .id(notification.getId())
                .severity(notification.getSeverity())
                .title(notification.getTitle())
                .description(notification.getDescription())
                .createdAt(notification.getCreatedAt())
                .category(category)
                .type(notification.getType())
                .attributes(notification.getAttributes())
                .read(read)
                .build();
    }

    public GenericConnection<GenericEdge<NotificationView>> toConnection(GenericQueryResult<NotificationView> result) {
        List<GenericEdge<NotificationView>> edges = result.getItems().stream()
                .map(view -> GenericEdge.<NotificationView>builder()
                        .node(view)
                        .cursor(CursorCodec.encode(view.id()))
                        .build())
                .toList();

        return GenericConnection.<GenericEdge<NotificationView>>builder()
                .edges(edges)
                .pageInfo(result.getPageInfo())
                .build();
    }
}
