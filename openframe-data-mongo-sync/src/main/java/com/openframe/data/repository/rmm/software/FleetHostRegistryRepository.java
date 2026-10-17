package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.FleetHostRegistry;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface FleetHostRegistryRepository extends MongoRepository<FleetHostRegistry, String> {

    Optional<FleetHostRegistry> findByFleetHostId(Long fleetHostId);

    List<FleetHostRegistry> findByFleetHostIdIn(Collection<Long> fleetHostIds);

    Optional<FleetHostRegistry> findByTenantIdAndMachineId(String tenantId, String machineId);

    long deleteByFleetHostId(Long fleetHostId);
}
