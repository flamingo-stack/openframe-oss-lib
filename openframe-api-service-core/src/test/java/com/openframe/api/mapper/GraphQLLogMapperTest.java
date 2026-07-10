package com.openframe.api.mapper;

import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.audit.LogEvent;
import com.openframe.api.dto.audit.LogFilterCriteria;
import com.openframe.api.dto.audit.LogFilterInput;
import com.openframe.api.dto.audit.LogSortField;
import com.openframe.api.dto.audit.LogSortInput;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link GraphQLLogMapper} — the LogSortInput conversion,
 * timestamp-range filter mapping, and compound edge-cursor encoding.
 */
class GraphQLLogMapperTest {

    private final GraphQLLogMapper mapper = new GraphQLLogMapper();

    @Test
    @DisplayName("TIMESTAMP maps to the eventTimestamp column and preserves direction")
    void toSortInputMapsTimestamp() {
        SortInput sort = mapper.toSortInput(LogSortInput.builder()
                .field(LogSortField.TIMESTAMP)
                .direction(SortDirection.ASC)
                .build());

        assertThat(sort).isNotNull();
        assertThat(sort.getField()).isEqualTo("eventTimestamp");
        assertThat(sort.getDirection()).isEqualTo(SortDirection.ASC);
    }

    @Test
    @DisplayName("null orderBy yields null (service applies its TIMESTAMP DESC default)")
    void toSortInputNull() {
        assertThat(mapper.toSortInput(null)).isNull();
    }

    @Test
    @DisplayName("orderBy without a field yields null")
    void toSortInputNullField() {
        assertThat(mapper.toSortInput(LogSortInput.builder().direction(SortDirection.ASC).build())).isNull();
    }

    @Test
    @DisplayName("timestamp range is carried into the filter criteria")
    void toLogFilterCriteriaMapsTimestampRange() {
        Instant from = Instant.ofEpochMilli(1000);
        Instant to = Instant.ofEpochMilli(2000);
        LogFilterInput input = LogFilterInput.builder()
                .timestampFrom(from)
                .timestampTo(to)
                .build();

        LogFilterCriteria criteria = mapper.toLogFilterCriteria(input);

        assertThat(criteria.getTimestampFrom()).isEqualTo(from);
        assertThat(criteria.getTimestampTo()).isEqualTo(to);
    }

    @Test
    @DisplayName("log edge cursor is compound <millis>_<toolEventId>")
    void toLogConnectionCompoundCursor() {
        LogEvent event = LogEvent.builder()
                .toolEventId("evt-7")
                .timestamp(Instant.ofEpochMilli(4321))
                .build();
        GenericQueryResult<LogEvent> result = GenericQueryResult.<LogEvent>builder()
                .items(List.of(event))
                .pageInfo(PageInfo.builder().build())
                .build();

        GenericConnection<GenericEdge<LogEvent>> connection = mapper.toLogConnection(result);

        assertThat(connection.getEdges()).hasSize(1);
        assertThat(CursorCodec.decode(connection.getEdges().get(0).getCursor())).isEqualTo("4321_evt-7");
    }
}
