package com.openframe.data.repository.device;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import org.springframework.data.mongodb.core.query.Query;

import java.util.Collection;
import java.util.List;

public interface CustomMachineRepository {
    Query buildDeviceQuery(MachineQueryFilter filter, String search);

    List<Machine> findMachinesWithCursor(Query query, String cursor, int limit, String sortField, String sortDirection);

    List<Machine> findAvailableForScheduleWithCursor(Query baseQuery, Collection<String> assignedMachineIds, String cursor, int limit);

    List<String> findMachineIds(Query query);

    List<String> findMachineIdsByCriteria(String tenantId, MachineQueryFilter filter, Collection<String> osTypeScope);

    long countMachinesByCriteria(String tenantId, MachineQueryFilter filter, Collection<String> osTypeScope);

    long countMachines(Query query);

    boolean isSortableField(String field);

    String getDefaultSortField();
}
