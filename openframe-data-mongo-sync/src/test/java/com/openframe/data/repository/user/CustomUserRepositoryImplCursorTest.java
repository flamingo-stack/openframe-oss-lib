package com.openframe.data.repository.user;

import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.user.User;
import com.openframe.data.document.user.UserStatus;
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
class CustomUserRepositoryImplCursorTest {

    private static final String EMAIL = "email";
    private static final String ID = "id";
    private static final String STATUS = "status";
    private static final String AND = "$and";
    private static final String OR = "$or";
    private static final String GREATER = "$gt";
    private static final String LESS = "$lt";
    private static final String INVALID_CURSOR = "Invalid cursor";
    private static final String CURSOR_EMAIL = "jane_doe@acme.io";
    private static final String CURSOR_ID = "3f0c2a52-8a51-4d55-9c3b-0f6b7c9d2e11";
    private static final String CURSOR = CURSOR_EMAIL + "_" + CURSOR_ID;
    private static final UserListFilter NO_FILTER = new UserListFilter(null, null, null, null);
    private static final int FETCH_LIMIT = 21;

    @Mock private MongoTemplate mongoTemplate;
    @Captor private ArgumentCaptor<Query> queryCaptor;
    @InjectMocks private CustomUserRepositoryImpl repository;

    @ParameterizedTest
    @MethodSource("fetchDirections")
    void findUsersPage_noCursor_sortsByEmailThenIdInFetchDirection(boolean backward, String operator, int order) {
        // setup
        Document expectedSort = new Document(EMAIL, order).append(ID, order);

        // execution
        repository.findUsersPage(NO_FILTER, null, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(User.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getSortObject()).containsExactlyEntriesOf(expectedSort);
        assertThat(query.getLimit()).isEqualTo(FETCH_LIMIT);
        assertThat(query.getQueryObject()).isEmpty();
    }

    @ParameterizedTest
    @MethodSource("fetchDirections")
    void findUsersPage_emailAndIdCursor_continuesPastTheEmailThenTheIdInFetchDirection(
            boolean backward, String operator, int order) {
        // setup
        Document expectedPosition = positionPast(CURSOR_EMAIL, CURSOR_ID, operator);
        Document expectedSort = new Document(EMAIL, order).append(ID, order);

        // execution
        repository.findUsersPage(NO_FILTER, CURSOR, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(User.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND, Document.class)).containsExactly(expectedPosition);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(expectedSort);
    }

    @Test
    void findUsersPage_backwardWithAFilter_keepsTheFilterNextToThePosition() {
        // setup
        UserListFilter activeOnly = new UserListFilter(List.of(UserStatus.ACTIVE), null, null, null);
        Document activeStatus = new Document(STATUS, new Document("$in", List.of(UserStatus.ACTIVE)));
        Document expectedPosition = positionPast(CURSOR_EMAIL, CURSOR_ID, LESS);

        // execution
        repository.findUsersPage(activeOnly, CURSOR, true, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(User.class));
        assertThat(queryCaptor.getValue().getQueryObject().getList(AND, Document.class))
                .containsExactly(activeStatus, expectedPosition);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void findUsersPage_backwardWithoutCursorText_readsFromTheEndWithoutAPosition(String cursor) {
        // setup
        Document descending = new Document(EMAIL, -1).append(ID, -1);

        // execution
        repository.findUsersPage(NO_FILTER, cursor, true, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(User.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject()).isEmpty();
        assertThat(query.getSortObject()).containsExactlyEntriesOf(descending);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "no-separator",
            "jane@acme.io_",
            "_3f0c2a52-8a51-4d55-9c3b-0f6b7c9d2e11",
            "65f1a2b3c4d5e6f708192a3b",
            "k1|email|ASC|amFuZUBhY21lLmlv|65f1a2b3c4d5e6f708192a3b"
    })
    void findUsersPage_cursorThatIsNotAUserPosition_throwsInvalidCursor(String cursor) {
        // setup
        boolean forward = false;

        // execution
        Throwable thrown = catchThrowable(() -> repository.findUsersPage(NO_FILTER, cursor, forward, FETCH_LIMIT));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(mongoTemplate, never()).find(any(Query.class), eq(User.class));
    }

    private static Stream<Arguments> fetchDirections() {
        return Stream.of(
                arguments(false, GREATER, 1),
                arguments(true, LESS, -1));
    }

    private static Document positionPast(String email, String id, String operator) {
        Document pastEmail = new Document(EMAIL, new Document(operator, email));
        Document sameEmail = new Document(EMAIL, email);
        Document pastId = new Document(ID, new Document(operator, id));
        Document sameEmailPastId = new Document(AND, List.of(sameEmail, pastId));
        return new Document(OR, List.of(pastEmail, sameEmailPastId));
    }
}
