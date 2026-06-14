package com.openframe.api.mapper;

import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.notification.NotificationView;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationContextDescriptorRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class GraphQLNotificationMapper {

    private final NotificationContextDescriptorRegistry descriptorRegistry;

    public CursorPaginationCriteria toCursorPaginationCriteria(ConnectionArgs args) {
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    public NotificationView toView(Notification notification, boolean read) {
        NotificationContext context = notification.getContext();
        NotificationCategory category = categoryOf(notification);
        return NotificationView.builder()
                .id(notification.getId())
                .severity(notification.getSeverity())
                .title(notification.getTitle())
                .description(notification.getDescription())
                .createdAt(notification.getCreatedAt())
                .category(category)
                .context(context)
                .read(read)
                .build();
    }

    private NotificationCategory categoryOf(Notification notification) {
        NotificationCategory stored = notification.getCategory();
        if (stored != null) {
            return stored;
        }
        return descriptorRegistry.categoryOf(notification.getContext().getType());
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
