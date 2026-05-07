package com.openframe.api.mapper;

import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.notification.NotificationView;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class GraphQLNotificationMapper {

    public CursorPaginationCriteria toCursorPaginationCriteria(ConnectionArgs args) {
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    public GenericConnection<GenericEdge<NotificationView>> toConnection(GenericQueryResult<NotificationView> result) {
        List<GenericEdge<NotificationView>> edges = result.getItems().stream()
                .map(view -> GenericEdge.<NotificationView>builder()
                        .node(view)
                        .cursor(CursorCodec.encode(view.getId()))
                        .build())
                .toList();

        return GenericConnection.<GenericEdge<NotificationView>>builder()
                .edges(edges)
                .pageInfo(result.getPageInfo())
                .build();
    }
}
