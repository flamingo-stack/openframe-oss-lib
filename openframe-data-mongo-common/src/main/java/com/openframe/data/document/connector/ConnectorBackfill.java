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
@Document(collection = "connector_backfills")
public class ConnectorBackfill {

    @Id
    private String id;
    private String baseName;
    private String connectorName;
    private Instant gapFrom;
    private ConnectorBackfillStatus status;
    private Instant createdAt;
    private Instant sentAt;
}
