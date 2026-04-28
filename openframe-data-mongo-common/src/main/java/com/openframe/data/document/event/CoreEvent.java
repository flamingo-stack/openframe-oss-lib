// services/openframe-core/src/main/java/com/openframe/core/model/CoreEvent.java
package com.openframe.data.document.event;

import com.openframe.data.document.TenantScoped;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "events")
public class CoreEvent implements TenantScoped {
    @Id
    private String id;

    @Indexed
    private String tenantId;

    private String type;
    private String payload;
    private Instant timestamp;
    private String userId;
    private EventStatus status;

    public enum EventStatus {
        CREATED, PROCESSING, COMPLETED, FAILED
    }
}
