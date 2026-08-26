package com.openframe.data.repository.device;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.DeviceFacetDimension;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.document.rmm.script.OsType;

import java.util.Collection;
import java.util.List;
import java.util.Map;

public interface CustomMachineRepository {

    long countMachines(String tenantId, MachineQueryFilter filter, String search);

    Map<String, Integer> facet(String tenantId, MachineQueryFilter filter, String search, DeviceFacetDimension dimension);

    List<String> findMachineIds(String tenantId, MachineQueryFilter filter, String search);

    List<Machine> findMachinesWithCursor(String tenantId, MachineQueryFilter filter, String search,
                                         String cursor, int limit,
                                         String sortField, String sortDirection);

    List<Machine> findAvailableForScheduleWithCursor(String tenantId, MachineQueryFilter filter, String search,
                                                     Collection<String> assignedMachineIds,
                                                     String cursor, int limit);

    List<String> findMachineIdsByCriteria(String tenantId, MachineQueryFilter filter, Collection<OsType> osTypeScope);

    long countMachinesByCriteria(String tenantId, MachineQueryFilter filter, Collection<OsType> osTypeScope);

    boolean isSortableField(String field);

    String getDefaultSortField();
}
