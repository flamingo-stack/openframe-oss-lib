package com.openframe.data.repository.tool;

import com.openframe.data.document.tool.IntegratedTool;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface IntegratedToolRepository extends MongoRepository<IntegratedTool, String>, BaseIntegratedToolRepository<Optional<IntegratedTool>, Boolean, String>, CustomIntegratedToolRepository {
    @Override
    Optional<IntegratedTool> findByType(String type);

    Optional<IntegratedTool> findByKey(String key);
}
