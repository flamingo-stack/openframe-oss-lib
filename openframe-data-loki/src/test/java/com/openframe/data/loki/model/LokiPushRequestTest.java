package com.openframe.data.loki.model;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class LokiPushRequestTest {

    @Test
    void ofSingleEntry_labelsLineAndMetadata_buildsOneStreamWithOneValue() {
        Map<String, String> labels = Map.of("job", "tool-events", "tenant_id", "tenant-a");
        Map<String, String> metadata = Map.of("tool_event_id", "evt-1");

        LokiPushRequest request = LokiPushRequest.ofSingleEntry(labels, 1_700_000_000_123_000_000L, "the line", metadata);

        assertThat(request.streams())
                .singleElement()
                .isEqualTo(new LokiPushRequest.Stream(labels,
                        List.of(List.of("1700000000123000000", "the line", metadata))));
    }
}
