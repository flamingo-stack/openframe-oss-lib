package com.openframe.test.data.dto.schedule;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.device.Machine;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Optional;

/** A page of a schedule's {@code assignedDevices} or {@code availableDevices}. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScheduleDeviceConnection {
    private List<ScheduleDeviceEdge> edges;
    private Integer filteredCount;

    public List<Machine> nodes() {
        return edges == null ? List.of() : edges.stream().map(ScheduleDeviceEdge::getNode).toList();
    }

    public List<String> ids() {
        return nodes().stream().map(Machine::getId).toList();
    }

    /** The edge for a given Machine global id, if it is on this page. */
    public Optional<ScheduleDeviceEdge> edgeFor(String machineGlobalId) {
        return edges == null ? Optional.empty()
                : edges.stream().filter(e -> e.getNode() != null && machineGlobalId.equals(e.getNode().getId())).findFirst();
    }
}
