package com.openframe.data.repository.rmm;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.rmm.schedule.ScheduleScriptExecution;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class CustomScheduleScriptExecutionRepositoryImplCursorTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String SCHEDULE_ID = "schedule-1";
    private static final String ID = "_id";
    private static final String DISPATCHED_AT = "dispatchedAt";
    private static final String AND = "$and";
    private static final String OR = "$or";
    private static final String LESS = "$lt";
    private static final String INVALID_CURSOR = "Invalid cursor";
    private static final String CURSOR_HEX = "65f1a2b3c4d5e6f708192a3b";
    private static final ObjectId CURSOR_ID = new ObjectId(CURSOR_HEX);
    private static final long CURSOR_MILLIS = 1_700_000_000_123L;
    private static final Instant CURSOR_INSTANT = Instant.ofEpochMilli(CURSOR_MILLIS);
    private static final int FETCH_LIMIT = 11;

    @Mock private MongoTemplate mongoTemplate;
    @Captor private ArgumentCaptor<Query> queryCaptor;
    @InjectMocks private CustomScheduleScriptExecutionRepositoryImpl repository;

    @ParameterizedTest
    @CsvSource({
            "_id, not-an-object-id",
            "dispatchedAt, no-separator",
            "dispatchedAt, 65f1a2b3c4d5e6f708192a3b",
            "dispatchedAt, 1700000000123|not-an-object-id",
            "dispatchedAt, yesterday|65f1a2b3c4d5e6f708192a3b",
            "dispatchedAt, |65f1a2b3c4d5e6f708192a3b"
    })
    void findPageForSchedule_cursorThatIsNotARunPosition_throwsInvalidCursor(String sortField, String cursor) {
        // setup
        Sort.Direction direction = Sort.Direction.DESC;

        // execution
        Throwable thrown = catchThrowable(() -> repository.findPageForSchedule(
                TENANT_ID, SCHEDULE_ID, null, null, sortField, direction, cursor, false, FETCH_LIMIT));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        assertThat((InvalidCursorException) thrown).returns(ErrorCode.INVALID_CURSOR, InvalidCursorException::getErrorCode);
        verify(mongoTemplate, never()).find(any(Query.class), eq(ScheduleScriptExecution.class));
    }

    @Test
    void findPageForSchedule_rowIdUnderTheIdSort_stillPagesPastThatId() {
        // setup
        Document pastId = new Document(ID, new Document(LESS, CURSOR_ID));

        // execution
        repository.findPageForSchedule(
                TENANT_ID, SCHEDULE_ID, null, null, ID, Sort.Direction.DESC, CURSOR_HEX, false, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(ScheduleScriptExecution.class));
        assertThat(queryCaptor.getValue().getQueryObject().getList(AND, Document.class))
                .hasSize(2)
                .contains(pastId);
    }

    @Test
    void findPageForSchedule_millisAndIdUnderTheDispatchSort_stillPagesPastThatValue() {
        // setup
        String cursor = CURSOR_MILLIS + "|" + CURSOR_HEX;
        Document pastValue = new Document(DISPATCHED_AT, new Document(LESS, CURSOR_INSTANT));
        Document sameValuePastId = new Document(AND, List.of(
                new Document(DISPATCHED_AT, CURSOR_INSTANT),
                new Document(ID, new Document(LESS, CURSOR_ID))));
        Document expectedKeyset = new Document(OR, List.of(pastValue, sameValuePastId));

        // execution
        repository.findPageForSchedule(
                TENANT_ID, SCHEDULE_ID, null, null, DISPATCHED_AT, Sort.Direction.DESC, cursor, false, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(ScheduleScriptExecution.class));
        assertThat(queryCaptor.getValue().getQueryObject().getList(AND, Document.class))
                .hasSize(2)
                .contains(expectedKeyset);
    }
}
