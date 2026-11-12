package com.openframe.data.repository.audit;

import com.openframe.data.document.audit.AuditEvent;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AuditEventRepository extends MongoRepository<AuditEvent, String> {
}
