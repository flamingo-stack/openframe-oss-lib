package com.openframe.data.repository.user;

import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.user.Invitation;
import com.openframe.data.document.user.InvitationStatus;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
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
class CustomInvitationRepositoryImplCursorTest {

    private static final String ID = "_id";
    private static final String CREATED_AT = "createdAt";
    private static final String STATUS = "status";
    private static final String AND = "$and";
    private static final String OR = "$or";
    private static final String GREATER = "$gt";
    private static final String LESS = "$lt";
    private static final String INVALID_CURSOR = "Invalid cursor";
    private static final Instant NOW = Instant.ofEpochMilli(1_760_000_000_000L);
    private static final Instant CURSOR_CREATED_AT = Instant.ofEpochMilli(1_750_000_000_000L);
    private static final String CURSOR_ID = "inv-1";
    private static final String VALUED_CURSOR = "1750000000000_inv-1";
    private static final String UNDATED_CURSOR = "_inv-1";
    private static final InvitationListFilter NO_FILTER = new InvitationListFilter(null, null, null);
    private static final Document PENDING_ONLY = new Document(STATUS, InvitationStatus.PENDING);
    private static final int FETCH_LIMIT = 21;

    @Mock private MongoTemplate mongoTemplate;
    @Captor private ArgumentCaptor<Query> queryCaptor;
    @InjectMocks private CustomInvitationRepositoryImpl repository;

    @ParameterizedTest
    @MethodSource("fetchOrders")
    void findOpenInvitationsPage_noCursor_sortsByCreatedAtThenIdInFetchDirection(boolean backward, int order) {
        // setup
        Document expectedSort = new Document(CREATED_AT, order).append(ID, order);

        // execution
        repository.findOpenInvitationsPage(NO_FILTER, NOW, null, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Invitation.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getSortObject()).containsExactlyEntriesOf(expectedSort);
        assertThat(query.getLimit()).isEqualTo(FETCH_LIMIT);
        assertThat(query.getQueryObject().getList(AND, Document.class)).containsExactly(PENDING_ONLY);
    }

    @Test
    void findOpenInvitationsPage_forwardAfterADatedCursor_olderRowsThenTheUndatedGroup() {
        // setup
        Document older = new Document(CREATED_AT, new Document(LESS, CURSOR_CREATED_AT));
        Document sameDatePastId = sameCreatedAtPastId(CURSOR_CREATED_AT, LESS);
        Document undatedGroup = new Document(CREATED_AT, null);
        Document expectedPosition = new Document(OR, List.of(older, sameDatePastId, undatedGroup));

        // execution
        repository.findOpenInvitationsPage(NO_FILTER, NOW, VALUED_CURSOR, false, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Invitation.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND, Document.class))
                .containsExactly(PENDING_ONLY, expectedPosition);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(CREATED_AT, -1).append(ID, -1));
    }

    @Test
    void findOpenInvitationsPage_backwardBeforeADatedCursor_newerRowsOnly() {
        // setup
        Document newer = new Document(CREATED_AT, new Document(GREATER, CURSOR_CREATED_AT));
        Document sameDatePastId = sameCreatedAtPastId(CURSOR_CREATED_AT, GREATER);
        Document expectedPosition = new Document(OR, List.of(newer, sameDatePastId));

        // execution
        repository.findOpenInvitationsPage(NO_FILTER, NOW, VALUED_CURSOR, true, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Invitation.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND, Document.class))
                .containsExactly(PENDING_ONLY, expectedPosition);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(CREATED_AT, 1).append(ID, 1));
    }

    @Test
    void findOpenInvitationsPage_forwardAfterAnUndatedCursor_onlyTheRestOfTheUndatedGroup() {
        // setup
        Document restOfUndatedGroup = sameCreatedAtPastId(null, LESS);

        // execution
        repository.findOpenInvitationsPage(NO_FILTER, NOW, UNDATED_CURSOR, false, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Invitation.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND, Document.class))
                .containsExactly(PENDING_ONLY, restOfUndatedGroup);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(CREATED_AT, -1).append(ID, -1));
    }

    @Test
    void findOpenInvitationsPage_backwardBeforeAnUndatedCursor_restOfTheUndatedGroupThenEveryDatedRow() {
        // setup
        Document restOfUndatedGroup = sameCreatedAtPastId(null, GREATER);
        Document everyDatedRow = new Document(CREATED_AT, new Document("$ne", null));
        Document expectedPosition = new Document(OR, List.of(restOfUndatedGroup, everyDatedRow));

        // execution
        repository.findOpenInvitationsPage(NO_FILTER, NOW, UNDATED_CURSOR, true, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Invitation.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND, Document.class))
                .containsExactly(PENDING_ONLY, expectedPosition);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(CREATED_AT, 1).append(ID, 1));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void findOpenInvitationsPage_backwardWithoutCursorText_readsFromTheEndWithoutAPosition(String cursor) {
        // setup
        Document ascending = new Document(CREATED_AT, 1).append(ID, 1);

        // execution
        repository.findOpenInvitationsPage(NO_FILTER, NOW, cursor, true, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Invitation.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND, Document.class)).containsExactly(PENDING_ONLY);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(ascending);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "no-separator",
            "yesterday_inv-1",
            "1750000000000_",
            "65f1a2b3c4d5e6f708192a3b",
            "k1|createdAt|DESC|1750000000000|65f1a2b3c4d5e6f708192a3b"
    })
    void findOpenInvitationsPage_cursorThatIsNotAnInvitationPosition_throwsInvalidCursor(String cursor) {
        // setup
        boolean forward = false;

        // execution
        Throwable thrown = catchThrowable(
                () -> repository.findOpenInvitationsPage(NO_FILTER, NOW, cursor, forward, FETCH_LIMIT));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(mongoTemplate, never()).find(any(Query.class), eq(Invitation.class));
    }

    private static Stream<Arguments> fetchOrders() {
        return Stream.of(
                arguments(false, -1),
                arguments(true, 1));
    }

    private static Document sameCreatedAtPastId(Instant createdAt, String operator) {
        Document sameCreatedAt = new Document(CREATED_AT, createdAt);
        Document pastId = new Document(ID, new Document(operator, CURSOR_ID));
        return new Document(AND, List.of(sameCreatedAt, pastId));
    }
}
