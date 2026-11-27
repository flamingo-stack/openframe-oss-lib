package com.openframe.data.repository.device;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.DeviceFacetDimension;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.repository.cursor.CursorPosition;
import com.openframe.data.repository.cursor.KeysetCursor;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;

public interface CustomMachineRepository {

    List<Machine> findMachines(String tenantId, MachineQueryFilter filter);

    List<Machine> findMachinesAfter(String tenantId, MachineQueryFilter filter, String afterMachineId, int limit);

    MachineNameMatches findMatchingNames(String tenantId, MachineQueryFilter filter);

    long countMachines(String tenantId, MachineQueryFilter filter, String search);

    Map<String, Integer> facet(String tenantId, MachineQueryFilter filter, String search, DeviceFacetDimension dimension);

    List<String> findMachineIds(String tenantId, MachineQueryFilter filter, String search);

    List<Machine> findMachinesWithCursor(String tenantId, MachineQueryFilter filter, String search,
                                         CursorPosition position, boolean backward, int limit,
                                         String sortField, String sortDirection);

    List<Machine> findAvailableForScheduleWithCursor(String tenantId, MachineQueryFilter filter, String search,
                                                     Collection<String> assignedMachineIds,
                                                     CursorPosition position, boolean backward, int limit);

    KeysetCursor keysetCursor(Machine machine, String sortField, String sortDirection);

    KeysetCursor availableForScheduleKeysetCursor(Machine machine, Collection<String> assignedMachineIds);

    List<String> findMachineIdsByCriteria(String tenantId, MachineQueryFilter filter, Collection<OsType> osTypeScope);

    long countMachinesByCriteria(String tenantId, MachineQueryFilter filter, Collection<OsType> osTypeScope);

    /**
     * Updates only the {@code lastSeen} timestamp of a machine, leaving every other field untouched.
     * Deliberately bypasses {@code save}/{@code saveAll} so the Pinot publishing aspect does not fire:
     * {@code lastSeen} is not part of the Pinot payload, so heartbeats that change nothing else must
     * not produce a Kafka message.
     */
    void updateLastSeen(String machineId, Instant lastSeen);

    // Bypasses save and MachineWriter like updateLastSeen: the marker is not part of the Pinot payload
    void markHostFactsChecked(String machineId, Instant checkedAt);

    // Live machines missing a Fleet host fact, never checked or checked before checkedBefore: never checked first
    List<Machine> findDueForFleetHostFacts(String tenantId, Instant checkedBefore, int limit);

    /** Reserves the observed device version for pending software dispatch without publishing an inventory change. */
    long reserveForSoftwareReconnect(String tenantId, String machineId, Long version, Collection<DeviceStatus> managedStatuses);

    /** Reserves the eligible devices for a software assignment without publishing inventory changes. */
    long reserveForSoftwareAssignments(String tenantId, Collection<String> machineIds, Collection<DeviceStatus> managedStatuses);

    boolean isSortableField(String field);

    String getDefaultSortField();
}
