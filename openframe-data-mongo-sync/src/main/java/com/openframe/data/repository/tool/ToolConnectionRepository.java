package com.openframe.data.repository.tool;

import com.openframe.data.document.tool.ConnectionStatus;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.Update;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/** Stores provider registrations and conditionally updates registration fields without replacing unrelated connection data. */
@Repository
public interface ToolConnectionRepository extends MongoRepository<ToolConnection, String> {
    /** Updates only registration-owned fields while the observed connection generation is unchanged. */
    @Query("""
            { '_id': ?#{[0].id}, 'tenantId': ?#{[0].tenantId}, 'machineId': ?#{[0].machineId},
              'toolType': ?#{[0].toolType}, 'status': ?#{[0].status}, 'agentToolId': ?#{[0].agentToolId},
              'connectedAt': ?#{[0].connectedAt}, 'disconnectedAt': ?#{[0].disconnectedAt},
              'lastSyncAt': ?#{[0].lastSyncAt} }
            """)
    @Update("""
            { '$set': { 'agentToolId': ?#{[1].agentToolId}, 'status': ?#{[1].status},
              'connectedAt': ?#{[1].connectedAt}, 'disconnectedAt': ?#{[1].disconnectedAt},
              'lastSyncAt': ?#{[1].lastSyncAt} } }
            """)
    long updateRegistrationIfUnchanged(ToolConnection observed, ToolConnection registration);

    List<ToolConnection> findByMachineId(String machineId);

    List<ToolConnection> findByMachineIdIn(List<String> machineIds);

    /**
     * Find the most recent ToolConnection by agentToolId
     * Sorted by connectedAt in descending order to get the latest record
     */
    Optional<ToolConnection> findFirstByAgentToolIdOrderByConnectedAtDesc(String agentToolId);

    Optional<ToolConnection> findFirstByAgentToolIdAndToolTypeOrderByConnectedAtDesc(
            String agentToolId, ToolType toolType);

    Optional<ToolConnection> findFirstByTenantIdAndToolTypeAndAgentToolIdOrderByConnectedAtDesc(
            String tenantId, ToolType toolType, String agentToolId);

    Optional<ToolConnection> findByMachineIdAndToolType(String machineId, ToolType toolType);

    List<ToolConnection> findByMachineIdAndToolTypeInAndStatus(String machineId, Collection<ToolType> toolTypes,
                                                              ConnectionStatus status);

    List<ToolConnection> findByToolType(ToolType toolType);

    List<ToolConnection> findByAgentToolIdInAndToolType(List<String> agentToolIds, ToolType toolType);

    // The Fleet host facts backfill reads the connections of the machines it is due to try, through the
    // tenant_machine_tool_idx index
    List<ToolConnection> findByTenantIdAndMachineIdInAndToolTypeAndStatus(
            String tenantId, Collection<String> machineIds, ToolType toolType, ConnectionStatus status);
}
