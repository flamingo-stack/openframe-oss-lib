package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsUpdate;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface DeviceOsUpdateRepository extends MongoRepository<DeviceOsUpdate, String> {

    List<DeviceOsUpdate> findByTenantIdAndMachineIdOrderByDiscoveredAtDescTitleAsc(String tenantId, String machineId);

    long deleteByTenantIdAndIdIn(String tenantId, Collection<String> ids);

    long deleteByTenantIdAndMachineId(String tenantId, String machineId);
}
