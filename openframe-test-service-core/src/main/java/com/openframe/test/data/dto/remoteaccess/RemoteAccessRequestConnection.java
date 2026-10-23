package com.openframe.test.data.dto.remoteaccess;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.shared.PageInfo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// remoteAccessRequests: a device's connect-attempt audit, newest first.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class RemoteAccessRequestConnection {
    private List<RemoteAccessRequestEdge> edges;
    private PageInfo pageInfo;
    private Integer totalCount;

    public List<RemoteAccessRequestAudit> nodes() {
        return edges == null ? List.of() : edges.stream().map(RemoteAccessRequestEdge::getNode).toList();
    }
}
