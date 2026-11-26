package com.openframe.data.repository.rmm;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.filter.ExecutionOwnerScope;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.software.SoftwareAction;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
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
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class CustomScriptExecutionRepositoryImplCursorTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String TENANT_FIELD = "tenantId";
    private static final String ID = "_id";
    private static final String DISPATCHED_AT = "dispatchedAt";
    private static final String FINISHED_AT = "finishedAt";
    private static final String AND = "$and";
    private static final String OR = "$or";
    private static final String GREATER = "$gt";
    private static final String LESS = "$lt";
    private static final String INVALID_CURSOR = "Invalid cursor";
    private static final String CURSOR_HEX = "65f1a2b3c4d5e6f708192a3b";
    private static final ObjectId CURSOR_ID = new ObjectId(CURSOR_HEX);
    private static final long CURSOR_MILLIS = 1_700_000_000_123L;
    private static final Instant CURSOR_INSTANT = Instant.ofEpochMilli(CURSOR_MILLIS);
    private static final int FETCH_LIMIT = 11;

    @Mock private MongoTemplate mongoTemplate;
    @Captor private ArgumentCaptor<Query> queryCaptor;
    @InjectMocks private CustomScriptExecutionRepositoryImpl repository;

    @ParameterizedTest
    @MethodSource("unusableCursorsOfEachList")
    void findPage_cursorThatIsNotAnExecutionPosition_throwsInvalidCursor(
            ExecutionOwnerScope owner, String sortField, String cursor) {
        // setup
        Sort.Direction direction = Sort.Direction.DESC;

        // execution
        Throwable thrown = catchThrowable(() -> repository.findPage(
                TENANT_ID, owner, null, sortField, direction, cursor, false, FETCH_LIMIT, null));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        assertThat((InvalidCursorException) thrown).returns(ErrorCode.INVALID_CURSOR, InvalidCursorException::getErrorCode);
        verify(mongoTemplate, never()).find(any(Query.class), eq(ScriptExecution.class));
    }

    @ParameterizedTest
    @MethodSource("ownersOfEachList")
    void findPage_rowIdUnderTheIdSort_stillPagesPastThatId(ExecutionOwnerScope owner) {
        // setup
        Document pastId = new Document(LESS, CURSOR_ID);

        // execution
        repository.findPage(TENANT_ID, owner, null, ID, Sort.Direction.DESC, CURSOR_HEX, false, FETCH_LIMIT, null);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(ScriptExecution.class));
        assertThat(queryCaptor.getValue().getQueryObject())
                .containsEntry(TENANT_FIELD, TENANT_ID)
                .containsEntry(ID, pastId);
    }

    @ParameterizedTest
    @MethodSource("ownersOfEachList")
    void findPage_millisAndIdUnderATimeSort_stillPagesPastThatValue(ExecutionOwnerScope owner) {
        // setup
        String cursor = CURSOR_MILLIS + "|" + CURSOR_HEX;
        Document pastValue = new Document(DISPATCHED_AT, new Document(LESS, CURSOR_INSTANT));
        Document sameValuePastId = new Document(AND, List.of(
                new Document(DISPATCHED_AT, CURSOR_INSTANT),
                new Document(ID, new Document(LESS, CURSOR_ID))));
        Document nullGroup = new Document(DISPATCHED_AT, null);
        Document expectedKeyset = new Document(OR, List.of(pastValue, sameValuePastId, nullGroup));

        // execution
        repository.findPage(TENANT_ID, owner, null, DISPATCHED_AT, Sort.Direction.DESC, cursor, false, FETCH_LIMIT, null);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(ScriptExecution.class));
        assertThat(queryCaptor.getValue().getQueryObject().getList(AND, Document.class))
                .hasSize(2)
                .contains(expectedKeyset);
    }

    @ParameterizedTest
    @MethodSource("ownersOfEachList")
    void findPage_emptyValueAndIdUnderATimeSort_stillPagesFromInsideTheNullGroup(ExecutionOwnerScope owner) {
        // setup
        String cursor = "|" + CURSOR_HEX;
        Document restOfNullGroup = new Document(AND, List.of(
                new Document(FINISHED_AT, null),
                new Document(ID, new Document(GREATER, CURSOR_ID))));
        Document everyValue = new Document(FINISHED_AT, new Document("$ne", null));
        Document expectedKeyset = new Document(OR, List.of(restOfNullGroup, everyValue));

        // execution
        repository.findPage(TENANT_ID, owner, null, FINISHED_AT, Sort.Direction.ASC, cursor, false, FETCH_LIMIT, null);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(ScriptExecution.class));
        assertThat(queryCaptor.getValue().getQueryObject().getList(AND, Document.class))
                .hasSize(2)
                .contains(expectedKeyset);
    }

    private static Stream<Arguments> ownersOfEachList() {
        return owners().map(Arguments::arguments);
    }

    private static Stream<Arguments> unusableCursorsOfEachList() {
        return owners().flatMap(owner -> Stream.of(
                arguments(owner, ID, "not-an-object-id"),
                arguments(owner, DISPATCHED_AT, "no-separator"),
                arguments(owner, DISPATCHED_AT, CURSOR_HEX),
                arguments(owner, DISPATCHED_AT, CURSOR_MILLIS + "|not-an-object-id"),
                arguments(owner, FINISHED_AT, "yesterday|" + CURSOR_HEX)));
    }

    private static Stream<ExecutionOwnerScope> owners() {
        return Stream.of(
                ExecutionOwnerScope.forScript("script-1"),
                ExecutionOwnerScope.forSchedule("schedule-1"),
                ExecutionOwnerScope.forSoftware(PackageManagerType.WINGET, "Mozilla.Firefox", SoftwareAction.INSTALL));
    }
}
