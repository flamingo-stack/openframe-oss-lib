package com.openframe.data.document.event;

import com.openframe.data.document.TenantScoped;
import lombok.Builder;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "events")
@Data
@Builder
public class Event implements TenantScoped {
    @Id
    private String id;

    @Indexed
    private String tenantId;

    private String type;
    private String payload;
    private Instant timestamp;
    private String userId;
}
