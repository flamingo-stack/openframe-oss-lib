package com.openframe.data.document.connector;

import com.openframe.data.document.TenantScoped;
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
@Document(collection = "connector_alerts")
public class ConnectorAlert implements TenantScoped {

    @Id
    private String id;

    @Indexed
    private String tenantId;

    private String connectorName;
    private ConnectorAlertType errorType;
    private String errorMessage;
    private int attempts;
    private Instant createdAt;
    private boolean resolved;
    private Instant resolvedAt;
}
