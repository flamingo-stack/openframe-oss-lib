package com.openframe.debezium.recovery.gap;

import com.openframe.debezium.util.ConnectorSpecs;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Component
@ConditionalOnProperty(name = "openframe.debezium.recovery.gap.enabled", havingValue = "true")
public class MongoSourceDialect extends SourceDialect {

    private static final String CONNECTOR_CLASS = "io.debezium.connector.mongodb.MongoDbConnector";
    private static final String KEY_COLLECTIONS = "collection.include.list";
    private static final String PARTITION_KEY = "server_id";
    private static final String OFFSET_TIME_KEY = "sec";
    // An ObjectId starts with its creation second, so this bound walks the _id index instead of scanning.
    private static final String ID_FROM_FILTER = "{\"_id\": {\"$gte\": {\"$oid\": \"%08x0000000000000000\"}}}";
    private static final List<String> HISTORY_LOST_MARKERS = List.of(
            "ChangeStreamHistoryLost",
            "InvalidResumeToken",
            "Resume of change stream was not possible"
    );

    @Override
    public String connectorClass() {
        return CONNECTOR_CLASS;
    }

    @Override
    public List<String> historyLostMarkers() {
        return HISTORY_LOST_MARKERS;
    }

    @Override
    public List<SnapshotCondition> gapConditions(Map<String, Object> config,
                                                Map<String, String> backfill,
                                                Instant gapFrom) {
        String filter = ID_FROM_FILTER.formatted(gapFrom.getEpochSecond());
        String collections = ConnectorSpecs.stringOf(config, KEY_COLLECTIONS);
        return splitList(collections).stream()
                .map(collection -> new SnapshotCondition(collection, filter))
                .toList();
    }

    @Override
    protected String partitionKey() {
        return PARTITION_KEY;
    }

    @Override
    protected String offsetTimeKey() {
        return OFFSET_TIME_KEY;
    }
}
