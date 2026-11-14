package com.openframe.data.document.connector;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "connector_checkpoints")
public class ConnectorCheckpoint {

    @Id
    private String baseName;
    private String connectorName;
    private List<Map<String, Object>> offsets;
    private Instant capturedAt;
}
