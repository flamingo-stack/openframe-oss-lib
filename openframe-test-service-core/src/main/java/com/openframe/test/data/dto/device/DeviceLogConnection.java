package com.openframe.test.data.dto.device;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.shared.PageInfo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// Relay connection returned by deviceLogs, newest first; after pages towards older entries.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class DeviceLogConnection {
    private List<DeviceLogEdge> edges;
    private PageInfo pageInfo;

    public List<DeviceLogEntry> nodes() {
        return edges == null ? List.of() : edges.stream().map(DeviceLogEdge::getNode).toList();
    }
}
