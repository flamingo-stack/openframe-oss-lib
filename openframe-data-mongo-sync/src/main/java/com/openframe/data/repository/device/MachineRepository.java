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

    List<Machine> findByMachineIdIn(Collection<String> machineIds);

    List<Machine> findByTenantIdAndMachineIdIn(String tenantId, Collection<String> machineIds);

    List<Machine> findByTenantIdAndOsUuidIn(String tenantId, Collection<String> osUuids);

    List<Machine> findByTenantIdAndSerialNumberIn(String tenantId, Collection<String> serialNumbers);

    List<Machine> findByTenantIdAndHostnameIn(String tenantId, Collection<String> hostnames);

    Optional<Machine> findByTenantIdAndMachineId(String tenantId, String machineId);

    List<Machine> findByMachineIdInAndStatus(Collection<String> machineIds, DeviceStatus status);

    List<Machine> findByMachineIdInAndStatusIn(Collection<String> machineIds, Collection<DeviceStatus> statuses);

    List<Machine> findByStatusIn(Collection<DeviceStatus> statuses);

    long countByStatusIn(Collection<DeviceStatus> statuses);

    List<Machine> findByStatusInAndRegisteredAtBefore(Collection<DeviceStatus> statuses, Instant before);

    List<Machine> findByStatusAndLastSeenBefore(DeviceStatus status, Instant threshold);

    List<Machine> findByStatusAndRegisteredAtBeforeAndStuckNotifiedAtIsNull(DeviceStatus status, Instant before);

    boolean existsByOrganizationId(String organizationId);

    boolean existsByOrganizationIdAndStatusNotIn(String organizationId, Collection<DeviceStatus> statuses);
}
