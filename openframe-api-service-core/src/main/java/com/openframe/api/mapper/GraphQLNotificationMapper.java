package com.openframe.api.mapper;

import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.notification.NotificationView;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.data.document.notification.Notification;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class GraphQLNotificationMapper {

    public CursorPaginationCriteria toCursorPaginationCriteria(ConnectionArgs args) {
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    public NotificationView toView(Notification notification, boolean read) {
        return NotificationView.builder()
                .id(notification.getId())
                .severity(notification.getSeverity())
                .title(notification.getTitle())
                .description(notification.getDescription())
                .createdAt(notification.getCreatedAt())
                .context(notification.getContext())
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
