package com.openframe.repository.device;

import com.openframe.documents.device.Machine;
import com.openframe.documents.device.filter.MachineQueryFilter;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

public interface CustomMachineRepository {
    Query buildDeviceQuery(MachineQueryFilter filter, String search);

    List<Machine> findMachinesWithCursor(Query query, String cursor, int limit);
}
