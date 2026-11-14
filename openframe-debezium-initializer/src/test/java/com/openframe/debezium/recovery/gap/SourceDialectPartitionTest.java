package com.openframe.debezium.recovery.gap;

import com.openframe.debezium.dto.ConnectorOffsets;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class SourceDialectPartitionTest {

    private static final String PREFIX = "shared.meshcentral";

    @ParameterizedTest
    @MethodSource("partitionCases")
    void belongsTo_byPartitionPrefix_onlyWhenEveryPartitionHasTheConfigPrefix(SourceDialect dialect,
                                                                               ConnectorOffsets offsets,
                                                                               boolean expected) {
        // setup
        Map<String, Object> config = Map.of("topic.prefix", PREFIX);

        // execution
        boolean belongs = dialect.belongsTo(offsets, config);

        // verifications
        assertThat(belongs).isEqualTo(expected);
    }

    private static Stream<Arguments> partitionCases() {
        SourceDialect mongo = new MongoSourceDialect();
        SourceDialect mysql = new MySqlSourceDialect();
        return Stream.of(
                Arguments.of(mongo, offsets(Map.of("server_id", PREFIX)), true),
                Arguments.of(mongo, offsets(Map.of("server_id", "shared.meshcentral.old")), false),
                Arguments.of(mongo, offsets(Map.of("server", PREFIX)), false),
                Arguments.of(mongo, offsets(Map.of("server_id", PREFIX), Map.of("server_id", "other")), false),
                Arguments.of(mongo, ConnectorOffsets.empty(), false),
                Arguments.of(mysql, offsets(Map.of("server", PREFIX)), true),
                Arguments.of(mysql, offsets(Map.of("server", "other")), false),
                Arguments.of(mysql, offsets(Map.of("server_id", PREFIX)), false)
        );
    }

    @SafeVarargs
    private static ConnectorOffsets offsets(Map<String, Object>... partitions) {
        List<Map<String, Object>> entries = Stream.of(partitions)
                .map(partition -> Map.<String, Object>of("partition", partition, "offset", Map.of("sec", 1L)))
                .toList();
        return new ConnectorOffsets(entries);
    }
}
