package com.openframe.data.repository.user;

import com.openframe.data.document.user.Invitation;
import com.openframe.data.document.user.InvitationStatus;
import com.openframe.data.document.user.User;
import com.openframe.data.document.user.UserStatus;
import org.bson.Document;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/** The shape of the users / invitations listing queries: filters, search, order, keyset position. */
class UserListQueryTest {

    private static final String USER_ID = "3f0c2a52-8a51-4d55-9c3b-0f6b7c9d2e11";
    private static final Instant NOW = Instant.ofEpochMilli(1_760_000_000_000L);

    private final MongoTemplate template = mock(MongoTemplate.class);
    private final CustomUserRepositoryImpl users = new CustomUserRepositoryImpl(template);
    private final CustomInvitationRepositoryImpl invitations = new CustomInvitationRepositoryImpl(template);

    @Test
    @DisplayName("users: sorted by email asc / _id asc, limited, continued after the (email, id) cursor")
    void usersArePagedByEmailThenId() {
        users.findUsersPage(null, null, null, UserPageCursor.of("jane_doe@acme.io", USER_ID), 21);

        Query query = captured(User.class);
        assertThat(query.getLimit()).isEqualTo(21);
        assertThat(query.getSortObject()).isEqualTo(new Document("email", 1).append("_id", 1));

        // email > E, or email = E and _id > id
        List<?> position = (List<?>) and(query).getFirst().get("$or");
        assertThat(((Document) position.get(0)).get("email")).isEqualTo(new Document("$gt", "jane_doe@acme.io"));
        List<?> tie = (List<?>) ((Document) position.get(1)).get("$and");
        assertThat(((Document) tie.get(0)).get("email")).isEqualTo("jane_doe@acme.io");
        assertThat(((Document) tie.get(1)).get("_id")).isEqualTo(new Document("$gt", USER_ID));
    }

    @Test
    @DisplayName("users: statuses become $in, and every search word must match a name or a non-placeholder email")
    void usersFilterByStatusAndEverySearchWord() {
        users.findUsersPage(List.of(UserStatus.ACTIVE, UserStatus.DELETED), null, "  Jane   Doe ", null, 21);

        List<Document> and = and(captured(User.class));
        assertThat(and).hasSize(3);
        assertThat(and.get(0).get("status"))
                .isEqualTo(new Document("$in", List.of(UserStatus.ACTIVE, UserStatus.DELETED)));
        assertThat(wordAlternatives(and.get(1))).containsExactly("firstName", "lastName", "email");
        assertThat(wordAlternatives(and.get(2))).containsExactly("firstName", "lastName", "email");

        List<?> emailBranch = (List<?>) ((Document) ((List<?>) and.get(1).get("$or")).get(2)).get("$and");
        assertThat(((Document) emailBranch.get(1)).get("status"))
                .isEqualTo(new Document("$ne", UserStatus.SELF_DELETED));
    }

    @Test
    @DisplayName("users: no filter, no search and no cursor query the whole tenant")
    void usersWithoutConstraintsHaveAnEmptyFilter() {
        users.findUsersPage(List.of(), List.of(), " ", null, 21);

        assertThat(captured(User.class).getQueryObject()).isEmpty();
    }

    @Test
    @DisplayName("users: excluded ids become a $nin on _id")
    void usersLeaveOutExcludedIds() {
        users.findUsersPage(List.of(UserStatus.ACTIVE), List.of(USER_ID), null, null, 21);

        List<Document> and = and(captured(User.class));
        assertThat(and).hasSize(2);
        assertThat(and.get(1).get("_id")).isEqualTo(new Document("$nin", List.of(USER_ID)));
    }

    @Test
    @DisplayName("users: the count applies the filter and search but no position")
    void usersCountHasNoPosition() {
        users.countUsers(List.of(UserStatus.ACTIVE), null, "jane");

        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(template).count(captor.capture(), eq(User.class));
        List<Document> and = and(captor.getValue());
        assertThat(and).hasSize(2);
        assertThat(and.get(0)).containsKey("status");
        assertThat(and.get(1)).containsKey("$or");
    }

    @Test
    @DisplayName("invitations: only PENDING ones, sorted by createdAt desc / _id desc, continued after the cursor")
    void invitationsArePagedByCreatedAtThenId() {
        Instant createdAt = Instant.ofEpochMilli(1_750_000_000_000L);

        invitations.findOpenInvitationsPage(null, NOW, null, InvitationPageCursor.of(createdAt, "inv-1"), 21);

        Query query = captured(Invitation.class);
        assertThat(query.getLimit()).isEqualTo(21);
        assertThat(query.getSortObject()).isEqualTo(new Document("createdAt", -1).append("_id", -1));
        List<Document> and = and(query);
        assertThat(and.get(0).get("status")).isEqualTo(InvitationStatus.PENDING);

        // createdAt < C, or createdAt = C and _id < id, or no createdAt (sorted last)
        List<?> position = (List<?>) and.get(1).get("$or");
        assertThat(position).hasSize(3);
        assertThat(((Document) position.get(0)).get("createdAt")).isEqualTo(new Document("$lt", createdAt));
        List<?> tie = (List<?>) ((Document) position.get(1)).get("$and");
        assertThat(((Document) tie.get(0)).get("createdAt")).isEqualTo(createdAt);
        assertThat(((Document) tie.get(1)).get("_id")).isEqualTo(new Document("$lt", "inv-1"));
        assertThat(((Document) position.get(2)).get("createdAt")).isNull();
        assertThat((Document) position.get(2)).containsKey("createdAt");
    }

    @Test
    @DisplayName("invitations: past a cursor without createdAt only the rest of that group follows")
    void invitationsAfterACursorWithoutCreatedAt() {
        invitations.findOpenInvitationsPage(null, NOW, null, InvitationPageCursor.of(null, "inv-1"), 21);

        List<?> tie = (List<?>) and(captured(Invitation.class)).get(1).get("$and");
        assertThat((Document) tie.get(0)).containsEntry("createdAt", null);
        assertThat(((Document) tie.get(1)).get("_id")).isEqualTo(new Document("$lt", "inv-1"));
    }

    @Test
    @DisplayName("invitations: expired compares expiresAt with now, pending the other way round")
    void invitationsSplitIntoPendingAndExpiredAtNow() {
        invitations.countOpenInvitations(true, NOW, null);
        invitations.countOpenInvitations(false, NOW, null);

        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(template, times(2)).count(captor.capture(), eq(Invitation.class));
        assertThat(and(captor.getAllValues().get(0)).get(1).get("expiresAt")).isEqualTo(new Document("$lt", NOW));
        assertThat(and(captor.getAllValues().get(1)).get(1).get("expiresAt")).isEqualTo(new Document("$gte", NOW));
    }

    @Test
    @DisplayName("cursors: an email with underscores and an invitation without createdAt survive a round trip")
    void cursorsRoundTrip() {
        assertThat(UserPageCursor.parse(UserPageCursor.of("jane_doe@acme.io", USER_ID)))
                .contains(new UserPageCursor("jane_doe@acme.io", USER_ID));
        assertThat(InvitationPageCursor.parse(InvitationPageCursor.of(NOW, "inv-1")))
                .contains(new InvitationPageCursor(NOW, "inv-1"));
        assertThat(InvitationPageCursor.parse(InvitationPageCursor.of(null, "inv-1")))
                .contains(new InvitationPageCursor(null, "inv-1"));
    }

    @Test
    @DisplayName("cursors: malformed values are ignored instead of failing the query")
    void malformedCursorsAreIgnored() {
        assertThat(UserPageCursor.parse("no-separator")).isEmpty();
        assertThat(UserPageCursor.parse("jane@acme.io_")).isEmpty();
        assertThat(InvitationPageCursor.parse("yesterday_inv-1")).isEmpty();
        assertThat(InvitationPageCursor.parse("123_")).isEmpty();
    }

    private Query captured(Class<?> type) {
        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(template).find(captor.capture(), eq(type));
        return captor.getValue();
    }

    @SuppressWarnings("unchecked")
    private static List<Document> and(Query query) {
        return (List<Document>) query.getQueryObject().get("$and");
    }

    private static List<String> wordAlternatives(Document word) {
        return ((List<?>) word.get("$or")).stream()
                .map(Document.class::cast)
                .map(branch -> branch.containsKey("$and")
                        ? ((Document) ((List<?>) branch.get("$and")).getFirst()).keySet().iterator().next()
                        : branch.keySet().iterator().next())
                .toList();
    }
}
