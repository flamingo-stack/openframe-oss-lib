package com.openframe.debezium.recovery.gap;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class IncrementalSnapshotSignalTest {

    private static final SnapshotCondition FILTERED = new SnapshotCondition("fleet.activity_past", "created_at >= '2026-10-13 09:00:00'");
    private static final SnapshotCondition WHOLE = new SnapshotCondition("fleet.teams", "");

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void toJson_filteredAndWholeTables_debeziumExecuteSnapshotShape() throws Exception {
        // setup
        IncrementalSnapshotSignal signal = new IncrementalSnapshotSignal(List.of(FILTERED, WHOLE));

        // execution
        JsonNode json = objectMapper.readTree(signal.toJson(objectMapper));

        // verifications
        assertThat(json.path("id").asText()).isEqualTo(signal.getId());
        assertThat(json.path("type").asText()).isEqualTo("execute-snapshot");
        assertThat(json.path("data")).hasToString("""
                {"data-collections":["fleet.activity_past","fleet.teams"],"type":"INCREMENTAL",\
                "additional-conditions":[{"data-collection":"fleet.activity_past","filter":"created_at >= '2026-10-13 09:00:00'"}]}""");
    }

    @Test
    void toJson_twoSignals_distinctIds() {
        // setup
        IncrementalSnapshotSignal first = new IncrementalSnapshotSignal(List.of(WHOLE));
        IncrementalSnapshotSignal second = new IncrementalSnapshotSignal(List.of(WHOLE));

        // execution
        String firstId = first.getId();

        // verifications
        assertThat(firstId).isNotBlank().isNotEqualTo(second.getId());
    }
}
