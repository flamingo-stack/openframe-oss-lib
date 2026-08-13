package com.openframe.data.repository.installedagents;

import com.openframe.data.document.installedagents.UserInstalledAgent;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserInstalledAgentRepository extends MongoRepository<UserInstalledAgent, String> {

    List<UserInstalledAgent> findByUserId(String userId);

    Optional<UserInstalledAgent> findByUserIdAndAgentType(String userId, String agentType);

}
