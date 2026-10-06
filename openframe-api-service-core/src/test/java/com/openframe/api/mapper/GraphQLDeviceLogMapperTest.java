package com.openframe.api.mapper;

import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GraphQLDeviceLogMapperTest {

    private final GraphQLDeviceLogMapper mapper = new GraphQLDeviceLogMapper();

    @Test
    void decodesTheAfterCursor() {
        CursorPaginationCriteria criteria = mapper.toCursorPaginationCriteria(50, CursorCodec.encode("123:1"));

        assertThat(criteria.getCursor()).isEqualTo("123:1");
        assertThat(criteria.getLimit()).isEqualTo(50);
        assertThat(criteria.isBackward()).isFalse();
    }

    @Test
    void rejectsAnUndecodableCursorInsteadOfRestartingAtPageOne() {
        assertThatThrownBy(() -> mapper.toCursorPaginationCriteria(20, "!!not-base64!!"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
