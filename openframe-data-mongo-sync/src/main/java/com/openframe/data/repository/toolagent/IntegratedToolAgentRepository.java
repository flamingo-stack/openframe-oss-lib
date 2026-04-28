package com.openframe.data.repository.toolagent;

import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.ToolAgentStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface IntegratedToolAgentRepository extends MongoRepository<IntegratedToolAgent, String> {

    List<IntegratedToolAgent> findByStatus(ToolAgentStatus status);

    List<IntegratedToolAgent> findByReleaseVersionTrue();

    Optional<IntegratedToolAgent> findByKey(String key);
}
