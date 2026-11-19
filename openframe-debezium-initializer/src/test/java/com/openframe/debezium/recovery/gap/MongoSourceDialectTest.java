package com.openframe.debezium.recovery.gap;

import com.openframe.debezium.dto.ConnectorOffsets;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

class MongoSourceDialectTest {

    private static final Instant GAP_FROM = Instant.ofEpochSecond(1_791_885_584L);
    private static final String ID_FILTER = "{\"_id\": {\"$gte\": {\"$oid\": \"6ace01100000000000000000\"}}}";

    private final MongoSourceDialect dialect = new MongoSourceDialect();

    @Test
    void gapConditions_twoIncludedCollections_idLowerBoundPerCollection() {
        // setup
        Map<String, Object> config = Map.of("collection.include.list", "meshcentral.events, meshcentral.power");

        // execution
        List<SnapshotCondition> conditions = dialect.gapConditions(config, Map.of(), GAP_FROM);

        // verifications
        assertThat(conditions)
                .extracting(SnapshotCondition::getDataCollection, SnapshotCondition::getFilter)
                .containsExactly(
                        tuple("meshcentral.events", ID_FILTER),
                        tuple("meshcentral.power", ID_FILTER));
    }

    @Test
    void gapConditions_noIncludeList_noConditions() {
        // setup
        Map<String, Object> config = Map.of();

        // execution
        List<SnapshotCondition> conditions = dialect.gapConditions(config, Map.of(), GAP_FROM);

        // verifications
        assertThat(conditions).isEmpty();
    }

    @Test
    void sourceTime_secondsInOffset_instantOfThatSecond() {
        // setup
        ConnectorOffsets offsets = offsetsWith(Map.of("sec", 1_791_885_584, "ord", 16));

        // execution
        Instant sourceTime = dialect.sourceTime(offsets);

        // verifications
        assertThat(sourceTime).isEqualTo(GAP_FROM);
    }

    @Test
    void hasSourceTime_offsetWithSeconds_true() {
        // setup
        ConnectorOffsets offsets = offsetsWith(Map.of("sec", 1_791_885_584, "ord", 16));

        // execution
        boolean hasSourceTime = dialect.hasSourceTime(offsets);

        // verifications
        assertThat(hasSourceTime).isTrue();
    }

    @Test
    void hasSourceTime_offsetWithoutSeconds_false() {
        // setup
        ConnectorOffsets offsets = offsetsWith(Map.of("resume_token", "8263"));

        // execution
        boolean hasSourceTime = dialect.hasSourceTime(offsets);

        // verifications
        assertThat(hasSourceTime).isFalse();
    }

    @Test
    void hasSourceTime_emptyOffsets_false() {
        // setup
        ConnectorOffsets offsets = ConnectorOffsets.empty();

        // execution
        boolean hasSourceTime = dialect.hasSourceTime(offsets);

        // verifications
        assertThat(hasSourceTime).isFalse();
    }

    private static ConnectorOffsets offsetsWith(Map<String, Object> offset) {
        Map<String, Object> entry = Map.of("partition", Map.of("server_id", "shared.meshcentral"), "offset", offset);
        return new ConnectorOffsets(List.of(entry));
    }
}
