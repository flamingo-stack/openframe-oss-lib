package com.openframe.data.repository.device;

import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.device.Machine;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MachineRepository extends MongoRepository<Machine, String>, CustomMachineRepository{
    Optional<Machine> findByMachineId(String machineId);
    
    List<Machine> findByHostnameContainingIgnoreCase(String hostname);
    
    List<Machine> findByTypeAndHostnameContainingIgnoreCase(DeviceType deviceType, String hostname);
    
    List<Machine> findByType(DeviceType deviceType);
    
    /**
     * Check if any machines exist with the given organizationId
     * @param organizationId organization identifier
     * @return true if at least one machine exists with this organizationId
     */
    boolean existsByOrganizationId(String organizationId);
} 