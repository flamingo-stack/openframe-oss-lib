package com.openframe.data.repository.device;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.MachineQueryFilter;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface CustomMachineRepository {

    Optional<Machine> updateNickname(String machineId, String nickname, Instant updatedAt);

    long countMachines(MachineQueryFilter filter, String search);

    Map<String, Integer> facet(MachineQueryFilter filter, String search, String field);

    List<String> findMachineIds(MachineQueryFilter filter, String search);

    List<Machine> findMachinesWithCursor(MachineQueryFilter filter, String search,
                                         String cursor, int limit,
                                         String sortField, String sortDirection);

    List<Machine> findAvailableForScheduleWithCursor(MachineQueryFilter filter, String search,
                                                     Collection<String> assignedMachineIds,
                                                     String cursor, int limit);

    List<String> findMachineIdsByCriteria(String tenantId, MachineQueryFilter filter, Collection<String> osTypeScope);

    long countMachinesByCriteria(String tenantId, MachineQueryFilter filter, Collection<String> osTypeScope);

    boolean isSortableField(String field);

    String getDefaultSortField();
}
