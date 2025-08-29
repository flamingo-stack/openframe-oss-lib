package com.openframe.reactive.repository.tool;

import com.openframe.document.tool.IntegratedTool;
import com.openframe.repository.tool.BaseIntegratedToolRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

@Repository
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.REACTIVE)
public interface ReactiveIntegratedToolRepository extends ReactiveMongoRepository<IntegratedTool, String>, BaseIntegratedToolRepository<Mono<IntegratedTool>, Mono<Boolean>, String> {
    @Override
    Mono<IntegratedTool> findByType(String type);
} 