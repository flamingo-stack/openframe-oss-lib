package com.openframe.api.mapper;

import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
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

    public GenericConnection<GenericEdge<Notification>> toConnection(GenericQueryResult<Notification> result) {
        List<GenericEdge<Notification>> edges = result.getItems().stream()
                .map(notification -> GenericEdge.<Notification>builder()
                        .node(notification)
                        .cursor(CursorCodec.encode(notification.getId()))
                        .build())
                .toList();

        return GenericConnection.<GenericEdge<Notification>>builder()
                .edges(edges)
                .pageInfo(result.getPageInfo())
                .build();
    }
}
