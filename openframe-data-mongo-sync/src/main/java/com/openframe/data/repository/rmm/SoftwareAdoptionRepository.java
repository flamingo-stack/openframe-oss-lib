package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.software.SoftwareAdoption;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface SoftwareAdoptionRepository extends MongoRepository<SoftwareAdoption, String> {

    List<SoftwareAdoption> findByTenantIdAndSoftwareIdAndMachineIdIn(String tenantId, String softwareId, Collection<String> machineIds);

    Optional<SoftwareAdoption> findByTenantIdAndRequestIdAndMachineId(String tenantId, String requestId, String machineId);

    long deleteByTenantIdAndRequestIdAndMachineId(String tenantId, String requestId, String machineId);
}
