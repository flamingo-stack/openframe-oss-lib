package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.script.ScriptDeliveryRetry;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ScriptDeliveryRetryRepository extends MongoRepository<ScriptDeliveryRetry, String> {
}
