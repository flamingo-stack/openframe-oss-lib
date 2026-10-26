package com.openframe.test.data.dto.remoteaccess;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.shared.PageInfo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// remoteSessions: a device's session history, newest first.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class RemoteSessionConnection {
    private List<RemoteSessionEdge> edges;
    private PageInfo pageInfo;
    private Integer totalCount;

    public List<RemoteSession> nodes() {
        return edges == null ? List.of() : edges.stream().map(RemoteSessionEdge::getNode).toList();
    }
}
