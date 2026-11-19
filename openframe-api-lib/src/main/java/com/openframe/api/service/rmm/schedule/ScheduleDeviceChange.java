package com.openframe.api.service.rmm.schedule;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public record ScheduleDeviceChange(List<String> added, List<String> removed) {

    public static ScheduleDeviceChange between(Collection<String> before, Collection<String> after) {
        Set<String> beforeSet = new LinkedHashSet<>(before);
        Set<String> afterSet = new LinkedHashSet<>(after);
        List<String> added = afterSet.stream().filter(machineId -> !beforeSet.contains(machineId)).toList();
        List<String> removed = beforeSet.stream().filter(machineId -> !afterSet.contains(machineId)).toList();
        return new ScheduleDeviceChange(added, removed);
    }

    public boolean isEmpty() {
        return added.isEmpty() && removed.isEmpty();
    }
}
