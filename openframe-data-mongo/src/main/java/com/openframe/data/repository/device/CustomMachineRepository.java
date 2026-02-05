package com.openframe.data.repository.device;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

public interface CustomMachineRepository {
    Query buildDeviceQuery(MachineQueryFilter filter, String search);

    List<Machine> findMachinesWithCursor(Query query, String cursor, int limit, String sortField, String sortDirection);
    
    boolean isSortableField(String field);
    
    String getDefaultSortField();
}
