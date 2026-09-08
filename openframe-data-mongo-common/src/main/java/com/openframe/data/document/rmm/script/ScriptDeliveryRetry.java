package com.openframe.data.document.rmm.script;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "script_delivery_retry")
public class ScriptDeliveryRetry {

    @Id
    private String id;

    private String executionId;

    private String machineId;

    private int retryCount;

    private String messageJson;

    @Indexed(name = "script_delivery_retry_ttl", expireAfterSeconds = 0)
    private Instant expiresAt;
}
