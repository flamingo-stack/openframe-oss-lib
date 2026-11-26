package com.openframe.data.repository.rmm;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Query;

import java.util.Date;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomScriptScheduleRepositoryImplCursorTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String TENANT_FIELD = "tenantId";
    private static final String COLLECTION = "script_schedules";
    private static final String ID = "_id";
    private static final String NAME = "name";
    private static final String REPEAT = "repeat";
    private static final String START_AT = "startAt";
    private static final String DEVICE_COUNT = "deviceCount";
    private static final String TRIGGER_BUCKET = "_triggerBucket";
    private static final String MATCH = "$match";
    private static final String OR = "$or";
    private static final String GREATER = "$gt";
    private static final String LESS = "$lt";
    private static final String INVALID_CURSOR = "Invalid cursor";
    private static final String CURSOR_HEX = "65f1a2b3c4d5e6f708192a3b";
    private static final ObjectId CURSOR_ID = new ObjectId(CURSOR_HEX);
    private static final long START_AT_MILLIS = 1_735_689_600_000L;
    private static final int FETCH_LIMIT = 11;

    @Mock private MongoTemplate mongoTemplate;
    @Captor private ArgumentCaptor<Query> queryCaptor;
    @Captor private ArgumentCaptor<Aggregation> aggregationCaptor;
    @InjectMocks private CustomScriptScheduleRepositoryImpl repository;

    @ParameterizedTest
    @CsvSource({
            "_id, not-an-object-id",
            "_id, Backup|65f1a2b3c4d5e6f708192a3b",
            "name, no-separator",
            "name, 65f1a2b3c4d5e6f708192a3b",
            "name, Backup|not-an-object-id",
            "repeat, no-separator",
            "repeat, 1800|not-an-object-id",
            "repeat, soon|65f1a2b3c4d5e6f708192a3b",
            "deviceCount, no-separator",
            "deviceCount, 65f1a2b3c4d5e6f708192a3b",
            "deviceCount, 3|not-an-object-id",
            "deviceCount, many|65f1a2b3c4d5e6f708192a3b",
            "startAt, not-a-valid-cursor",
            "startAt, 65f1a2b3c4d5e6f708192a3b",
            "startAt, 1735689600000|65f1a2b3c4d5e6f708192a3b",
            "startAt, 0|1735689600000|not-an-object-id",
            "startAt, 0|soon|65f1a2b3c4d5e6f708192a3b",
            "startAt, first|1735689600000|65f1a2b3c4d5e6f708192a3b"
    })
    void findPageForTenant_cursorThatIsNotASchedulePosition_throwsInvalidCursor(String sortField, String cursor) {
        // setup
        Sort.Direction direction = Sort.Direction.DESC;

        // execution
        Throwable thrown = catchThrowable(() -> repository.findPageForTenant(
                TENANT_ID, null, null, sortField, direction, cursor, false, FETCH_LIMIT));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        assertThat((InvalidCursorException) thrown).returns(ErrorCode.INVALID_CURSOR, InvalidCursorException::getErrorCode);
        verify(mongoTemplate, never()).find(any(Query.class), eq(ScheduleScript.class));
        verify(mongoTemplate, never()).aggregate(any(Aggregation.class), eq(COLLECTION), eq(Document.class));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void findPageForTenant_noCursor_firstPageWithoutAKeyset(String cursor) {
        // setup
        Sort.Direction direction = Sort.Direction.ASC;

        // execution
        repository.findPageForTenant(TENANT_ID, null, null, NAME, direction, cursor, false, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(ScheduleScript.class));
        assertThat(queryCaptor.getValue().getQueryObject())
                .containsEntry(TENANT_FIELD, TENANT_ID)
                .doesNotContainKeys(OR, ID);
    }

    @ParameterizedTest
    @CsvSource({
            "DESC, false, $lt",
            "DESC, true, $gt",
            "ASC, false, $gt",
            "ASC, true, $lt"
    })
    void findPageForTenant_rowIdUnderTheIdSort_stillPagesPastThatId(
            Sort.Direction direction, boolean backward, String operator) {
        // setup
        Document pastId = new Document(operator, CURSOR_ID);

        // execution
        repository.findPageForTenant(TENANT_ID, null, null, ID, direction, CURSOR_HEX, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(ScheduleScript.class));
        assertThat(queryCaptor.getValue().getQueryObject())
                .containsEntry(TENANT_FIELD, TENANT_ID)
                .containsEntry(ID, pastId);
    }

    @ParameterizedTest
    @ValueSource(strings = {"Backup", "Backup|nightly"})
    void findPageForTenant_valueAndIdUnderTheNameSort_stillPagesPastThatName(String name) {
        // setup
        String cursor = name + "|" + CURSOR_HEX;
        Document pastValue = new Document(NAME, new Document(GREATER, name));
        Document sameValuePastId = new Document(NAME, name).append(ID, new Document(GREATER, CURSOR_ID));

        // execution
        repository.findPageForTenant(TENANT_ID, null, null, NAME, Sort.Direction.ASC, cursor, false, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(ScheduleScript.class));
        assertThat(queryCaptor.getValue().getQueryObject().getList(OR, Document.class))
                .containsExactly(pastValue, sameValuePastId);
    }

    @Test
    void findPageForTenant_valueAndIdUnderTheRepeatSort_stillPagesPastThatInterval() {
        // setup
        String cursor = "1800|" + CURSOR_HEX;
        Document pastValue = new Document(REPEAT, new Document(LESS, 1800L));
        Document sameValuePastId = new Document(REPEAT, 1800L).append(ID, new Document(LESS, CURSOR_ID));
        Document nullGroup = new Document(REPEAT, null);

        // execution
        repository.findPageForTenant(TENANT_ID, null, null, REPEAT, Sort.Direction.DESC, cursor, false, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(ScheduleScript.class));
        assertThat(queryCaptor.getValue().getQueryObject().getList(OR, Document.class))
                .containsExactly(pastValue, sameValuePastId, nullGroup);
    }

    @ParameterizedTest
    @ValueSource(strings = {NAME, REPEAT})
    void findPageForTenant_emptyValueAndId_stillPagesFromInsideTheNullGroup(String sortField) {
        // setup
        String cursor = "|" + CURSOR_HEX;
        Document restOfNullGroup = new Document(sortField, null).append(ID, new Document(GREATER, CURSOR_ID));
        Document everyValue = new Document(sortField, new Document("$ne", null));

        // execution
        repository.findPageForTenant(TENANT_ID, null, null, sortField, Sort.Direction.ASC, cursor, false, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(ScheduleScript.class));
        assertThat(queryCaptor.getValue().getQueryObject().getList(OR, Document.class))
                .containsExactly(restOfNullGroup, everyValue);
    }

    @Test
    void findPageForTenant_countAndIdUnderTheDeviceCountSort_stillPagesPastThatCount() {
        // setup
        stubNoAggregatedRows();
        String cursor = "3|" + CURSOR_HEX;
        Document pastCount = new Document(DEVICE_COUNT, new Document(GREATER, 3));
        Document sameCountPastId = new Document(DEVICE_COUNT, 3).append(ID, new Document(GREATER, CURSOR_ID));
        Document expectedKeyset = new Document(MATCH, new Document(OR, List.of(pastCount, sameCountPastId)));

        // execution
        repository.findPageForTenant(TENANT_ID, null, null, DEVICE_COUNT, Sort.Direction.ASC, cursor, false, FETCH_LIMIT);

        // verifications
        assertThat(capturedStages()).contains(expectedKeyset);
    }

    @Test
    void findPageForTenant_bucketMillisAndIdUnderTheStartSort_stillPagesPastThatStart() {
        // setup
        stubNoAggregatedRows();
        String cursor = "0|" + START_AT_MILLIS + "|" + CURSOR_HEX;
        Date startAt = new Date(START_AT_MILLIS);
        Document laterBuckets = new Document(TRIGGER_BUCKET, new Document(GREATER, 0));
        Document pastStart = new Document(TRIGGER_BUCKET, 0).append(START_AT, new Document(GREATER, startAt));
        Document sameStartPastId = new Document(TRIGGER_BUCKET, 0).append(START_AT, startAt)
                .append(ID, new Document(GREATER, CURSOR_ID));
        Document expectedKeyset = new Document(MATCH, new Document(OR, List.of(laterBuckets, pastStart, sameStartPastId)));

        // execution
        repository.findPageForTenant(TENANT_ID, null, null, START_AT, Sort.Direction.ASC, cursor, false, FETCH_LIMIT);

        // verifications
        assertThat(capturedStages()).contains(expectedKeyset);
    }

    @Test
    void findPageForTenant_bucketEmptyMillisAndIdUnderTheStartSort_stillPagesFromInsideTheUndatedGroup() {
        // setup
        stubNoAggregatedRows();
        String cursor = "1||" + CURSOR_HEX;
        Document laterBuckets = new Document(TRIGGER_BUCKET, new Document(GREATER, 1));
        Document restOfUndated = new Document(TRIGGER_BUCKET, 1).append(START_AT, null)
                .append(ID, new Document(LESS, CURSOR_ID));
        Document expectedKeyset = new Document(MATCH, new Document(OR, List.of(laterBuckets, restOfUndated)));

        // execution
        repository.findPageForTenant(TENANT_ID, null, null, START_AT, Sort.Direction.DESC, cursor, false, FETCH_LIMIT);

        // verifications
        assertThat(capturedStages()).contains(expectedKeyset);
    }

    private void stubNoAggregatedRows() {
        AggregationResults<Document> noRows = new AggregationResults<>(List.of(), new Document());
        when(mongoTemplate.aggregate(any(Aggregation.class), eq(COLLECTION), eq(Document.class))).thenReturn(noRows);
    }

    private List<Document> capturedStages() {
        verify(mongoTemplate).aggregate(aggregationCaptor.capture(), eq(COLLECTION), eq(Document.class));
        return aggregationCaptor.getValue().toPipeline(Aggregation.DEFAULT_CONTEXT);
    }
}
