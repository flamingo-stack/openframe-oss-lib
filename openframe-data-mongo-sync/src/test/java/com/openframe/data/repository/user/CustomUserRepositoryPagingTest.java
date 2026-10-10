package com.openframe.data.repository.user;

import com.openframe.data.document.user.User;
import com.openframe.data.document.user.UserStatus;
import com.openframe.data.document.user.filter.UserQueryFilter;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.entry;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

/**
 * The page order and the cursor have to agree, or a batch either repeats rows or skips them. These
 * tests pin the sort both reads share and what "after this row" asks for.
 */
class CustomUserRepositoryPagingTest {

    private static final LocalDateTime CREATED = LocalDateTime.of(2026, 3, 1, 12, 0);
    private static final String LAST_ID = "user-9";

    private final MongoTemplate template = mock(MongoTemplate.class);
    private final CustomUserRepositoryImpl repository = new CustomUserRepositoryImpl(template);

    @Test
    void findUsersBySearch_sortsNewestFirstWithTheRowIdBreakingTies() {
        // execution
        repository.findUsersBySearch(UserQueryFilter.builder().build(), 20);

        // verifications
        Query query = issuedQuery();
        assertThat(query.getSortObject()).containsExactly(entry("createdAt", -1), entry("id", -1));
        assertThat(query.getLimit()).isEqualTo(20);
    }

    @Test
    void findUserPageAfter_keepsTheSortAndTheFilterOfTheFirstPage() {
        // setup
        UserQueryFilter filter = UserQueryFilter.builder().status(UserStatus.ACTIVE).build();

        // execution
        repository.findUserPageAfter(filter, new UserSortKey(CREATED, LAST_ID), 20);

        // verifications
        Query query = issuedQuery();
        assertThat(query.getSortObject()).containsExactly(entry("createdAt", -1), entry("id", -1));
        assertThat(query.getQueryObject()).containsEntry("status", UserStatus.ACTIVE);
    }

    @Test
    void findUserPageAfter_datedRow_movesPastItAndStillReachesTheUndatedRows() {
        // execution
        repository.findUserPageAfter(
                UserQueryFilter.builder().build(), new UserSortKey(CREATED, LAST_ID), 20);

        // verifications: older rows, then the rows sharing this date beyond this id, and last the
        // rows with no date at all - a range query would never match those on its own.
        List<Document> branches = branches(issuedQuery().getQueryObject(), "$or");
        assertThat(branches).hasSize(3);
        assertThat(branches.get(0)).containsEntry("createdAt", new Document("$lt", CREATED));
        assertThat(branches.get(1)).containsEntry("$and", List.of(
                new Document("createdAt", CREATED),
                new Document("id", new Document("$lt", LAST_ID))));
        assertThat(branches.get(2)).containsEntry("createdAt", null);
    }

    @Test
    void findUserPageAfter_undatedRow_walksTheUndatedRowsByIdAlone() {
        // execution
        repository.findUserPageAfter(
                UserQueryFilter.builder().build(), new UserSortKey(null, LAST_ID), 20);

        // verifications
        assertThat(branches(issuedQuery().getQueryObject(), "$and")).containsExactly(
                new Document("createdAt", null),
                new Document("id", new Document("$lt", LAST_ID)));
    }

    private Query issuedQuery() {
        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(template).find(captor.capture(), eq(User.class));
        return captor.getValue();
    }

    @SuppressWarnings("unchecked")
    private static List<Document> branches(Document query, String operator) {
        return (List<Document>) query.get(operator);
    }
}
