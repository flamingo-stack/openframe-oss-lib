package com.openframe.data.reactive.repository.audit;

import com.openframe.data.document.audit.AuditEvent;
import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ReactiveAuditEventRepository extends ReactiveMongoRepository<AuditEvent, String> {
}
