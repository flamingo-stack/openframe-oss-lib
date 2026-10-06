package com.openframe.test.data.dto.software;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.shared.PageInfo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// Relay connection returned by softwareDevices.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class SoftwareOnDeviceConnection {
    private List<SoftwareOnDeviceEdge> edges;
    private PageInfo pageInfo;
    private Integer filteredCount;

    public List<SoftwareOnDevice> nodes() {
        return edges == null ? List.of() : edges.stream().map(SoftwareOnDeviceEdge::getNode).toList();
    }
}
