package com.openframe.data.repository.installedagents;

import com.openframe.data.document.installedagents.InstalledAgent;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InstalledAgentRepository extends MongoRepository<InstalledAgent, String> {

    List<InstalledAgent> findByMachineId(String machineId);

    List<InstalledAgent> findByMachineIdIn(List<String> machineIds);

    Optional<InstalledAgent> findByMachineIdAndAgentType(String machineId, String agentType);

}