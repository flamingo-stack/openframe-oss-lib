package com.openframe.data.repository.device;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.device.Machine;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface MachineRepository extends MongoRepository<Machine, String>, CustomMachineRepository{
    Optional<Machine> findByMachineId(String machineId);
    
    List<Machine> findByHostnameContainingIgnoreCase(String hostname);
    
    List<Machine> findByTypeAndHostnameContainingIgnoreCase(DeviceType deviceType, String hostname);
    
    List<Machine> findByType(DeviceType deviceType);
    
    List<Machine> findByMachineIdInAndStatus(Collection<String> machineIds, DeviceStatus status);
    
    List<Machine> findByStatusIn(Collection<DeviceStatus> statuses);

    List<Machine> findByStatusInAndRegisteredAtBefore(Collection<DeviceStatus> statuses, Instant before);

    List<Machine> findByStatusAndLastSeenBefore(DeviceStatus status, Instant threshold);

    boolean existsByOrganizationId(String organizationId);
} 