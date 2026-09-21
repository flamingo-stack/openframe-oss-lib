package com.openframe.test.data.dto.notification;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.shared.PageInfo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Relay connection returned by {@code notifications(...)}; it carries no filteredCount. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationConnection {
    private List<NotificationEdge> edges;
    private PageInfo pageInfo;

    public List<Notification> nodes() {
        return edges == null ? List.of() : edges.stream().map(NotificationEdge::getNode).toList();
    }

    public List<String> ids() {
        return nodes().stream().map(Notification::getId).toList();
    }
}
