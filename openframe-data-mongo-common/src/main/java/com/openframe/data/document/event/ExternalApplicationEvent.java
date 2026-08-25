package com.openframe.data.document.event;
import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.Map;
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "external_application_events")
public class ExternalApplicationEvent implements TenantScoped {
    @Id
    private String id;
    @Indexed
    private String tenantId;
    private String type;
    private String payload;
    private Instant timestamp;
    private String userId;
    private EventMetadata metadata;
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EventMetadata {
        private String source;
        private String version;
        private Map<String, String> tags;
    }
}

