package com.openframe.api.service.rmm.schedule;

import java.util.Collection;
import java.util.List;

public record ScheduleDeviceChange(List<String> added, List<String> removed) {

    public static ScheduleDeviceChange between(Collection<String> before, Collection<String> after) {
        List<String> added = after.stream().distinct().filter(machineId -> !before.contains(machineId)).toList();
        List<String> removed = before.stream().distinct().filter(machineId -> !after.contains(machineId)).toList();
        return new ScheduleDeviceChange(added, removed);
    }

    public boolean isEmpty() {
        return added.isEmpty() && removed.isEmpty();
    }
}
