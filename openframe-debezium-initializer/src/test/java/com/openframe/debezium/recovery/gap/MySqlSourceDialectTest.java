package com.openframe.debezium.recovery.gap;

import com.openframe.debezium.dto.ConnectorOffsets;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

class MySqlSourceDialectTest {

    private static final Instant GAP_FROM = Instant.parse("2026-10-13T09:05:07Z");
    private static final Map<String, Object> CONFIG = Map.of("table.include.list", "fleet.activity_past,fleet.teams");

    private final MySqlSourceDialect dialect = new MySqlSourceDialect();

    @Test
    void gapConditions_tableWithFilterTemplate_fromReplacedWithUtcSqlLiteral() {
        // setup
        Map<String, String> backfill = Map.of("fleet.activity_past", "created_at >= {from}");

        // execution
        List<SnapshotCondition> conditions = dialect.gapConditions(CONFIG, backfill, GAP_FROM);

        // verifications
        assertThat(conditions)
                .extracting(SnapshotCondition::getDataCollection, SnapshotCondition::getFilter)
                .containsExactly(
                        tuple("fleet.activity_past", "created_at >= '2026-10-13 09:05:07'"),
                        tuple("fleet.teams", ""));
    }

    @Test
    void gapConditions_noBackfillFilters_everyTableUnfiltered() {
        // setup
        Map<String, String> backfill = Map.of();

        // execution
        List<SnapshotCondition> conditions = dialect.gapConditions(CONFIG, backfill, GAP_FROM);

        // verifications
        assertThat(conditions)
                .extracting(SnapshotCondition::isFiltered)
                .containsOnly(false);
    }

    @Test
    void sourceTime_twoPartitions_latestSecondWins() {
        // setup
        Map<String, Object> older = Map.of("offset", Map.of("ts_sec", 100L, "file", "mysql-bin.1"));
        Map<String, Object> newer = Map.of("offset", Map.of("ts_sec", 200L, "file", "mysql-bin.2"));
        ConnectorOffsets offsets = new ConnectorOffsets(List.of(older, newer));

        // execution
        Instant sourceTime = dialect.sourceTime(offsets);

        // verifications
        assertThat(sourceTime).isEqualTo(Instant.ofEpochSecond(200L));
    }
}
