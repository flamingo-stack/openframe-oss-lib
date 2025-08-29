package com.openframe.repository.tool;

import com.openframe.document.tool.IntegratedTool;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public interface IntegratedToolRepository extends MongoRepository<IntegratedTool, String>, BaseIntegratedToolRepository<Optional<IntegratedTool>, Boolean, String> {
    @Override
    Optional<IntegratedTool> findByType(String type);
} 