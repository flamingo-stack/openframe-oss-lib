package com.openframe.data.document.connector;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "connector_alerts")
public class ConnectorAlert {

    @Id
    private String id;
    private String connectorName;
    private ConnectorAlertType errorType;
    private String errorMessage;
    private int attempts;
    private Instant createdAt;
    private boolean resolved;
    private Instant resolvedAt;
}
