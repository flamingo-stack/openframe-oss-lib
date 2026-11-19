package com.openframe.debezium.recovery.gap;

import com.openframe.debezium.util.ConnectorSpecs;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Component
@ConditionalOnProperty(name = "openframe.debezium.recovery.gap.enabled", havingValue = "true")
public class MySqlSourceDialect extends SourceDialect {

    private static final String CONNECTOR_CLASS = "io.debezium.connector.mysql.MySqlConnector";
    private static final String KEY_TABLES = "table.include.list";
    private static final String PARTITION_KEY = "server";
    private static final String OFFSET_TIME_KEY = "ts_sec";
    private static final String FROM_PLACEHOLDER = "{from}";
    private static final List<String> HISTORY_LOST_MARKERS = List.of(
            "is no longer available on the server",
            "Could not find first log file name in binary log index file",
            "The replication sender thread cannot start in AUTO_POSITION mode"
    );

    @Override
    public String connectorClass() {
        return CONNECTOR_CLASS;
    }

    @Override
    public List<String> historyLostMarkers() {
        return HISTORY_LOST_MARKERS;
    }

    // A table without a backfill filter is re-read whole, so only small tables may stay unlisted.
    // FROM_UNIXTIME renders the bound in the snapshot session's time zone, as TIMESTAMP columns are compared.
    @Override
    public List<SnapshotCondition> gapConditions(Map<String, Object> config,
                                                Map<String, String> backfill,
                                                Instant gapFrom) {
        String from = "FROM_UNIXTIME(" + gapFrom.getEpochSecond() + ")";
        String tables = ConnectorSpecs.stringOf(config, KEY_TABLES);
        return splitList(tables).stream()
                .map(table -> conditionFor(table, backfill, from))
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

    private SnapshotCondition conditionFor(String table, Map<String, String> backfill, String from) {
        String template = backfill.getOrDefault(table, "");
        String filter = template.replace(FROM_PLACEHOLDER, from);
        return new SnapshotCondition(table, filter);
    }
}
