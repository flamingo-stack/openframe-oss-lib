package com.openframe.authz.service.sso;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.auth.SsoIdentity;
import com.openframe.data.repository.auth.SsoIdentityRepository;
import org.bson.BsonString;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.Map;
import java.util.Optional;

import static com.openframe.authz.support.SsoTestFixtures.activeUser;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SsoIdentityServiceTest {

    @Mock
    private SsoIdentityRepository repository;
    @Mock
    private MongoTemplate mongoTemplate;
    @InjectMocks
    private SsoIdentityService service;

    private final AuthUser user = activeUser("user-1", "tenant-1", "ada@acme.com");

    @Test
    void shouldUseTenantAndObjectIdAsMicrosoftSubject() {
        assertThat(service.subjectOf("microsoft", Map.of("tid", "t-1", "oid", "o-1", "sub", "pairwise")))
                .contains("t-1:o-1");
    }

    @Test
    void shouldNeverFallBackToPairwiseSubForMicrosoft() {
        assertThat(service.subjectOf("microsoft", Map.of("oid", "o-1", "sub", "pairwise"))).isEmpty();
        assertThat(service.subjectOf("microsoft", Map.of("tid", "t-1", "sub", "pairwise"))).isEmpty();
        assertThat(service.subjectOf("microsoft", Map.of("tid", " ", "oid", "o-1"))).isEmpty();
    }

    @Test
    void shouldUseSubForGoogleAndApple() {
        assertThat(service.subjectOf("google", Map.of("sub", "g-1"))).contains("g-1");
        assertThat(service.subjectOf("apple", Map.of("sub", "a-1"))).contains("a-1");
        assertThat(service.subjectOf("google", Map.of("sub", 42))).isEmpty();
        assertThat(service.subjectOf("google", Map.of())).isEmpty();
    }

    @Test
    void shouldFindLinkBySubjectOnlyIgnoringEmail() {
        SsoIdentity link = SsoIdentity.builder().provider("google").subject("g-1").userId("user-1").build();
        when(repository.findByProviderAndSubject("google", "g-1")).thenReturn(Optional.of(link));

        assertThat(service.findLink("google", Map.of("sub", "g-1", "email", "someone-else@evil.com"))).contains(link);
    }

    @Test
    void shouldNotQueryWithoutSubject() {
        assertThat(service.findLink("microsoft", Map.of("sub", "pairwise"))).isEmpty();
        verifyNoInteractions(repository);
    }

    @Test
    void shouldRejectRegistrationOfAlreadyLinkedIdentity() {
        when(repository.findByProviderAndSubject("google", "g-1"))
                .thenReturn(Optional.of(SsoIdentity.builder().userId("user-9").build()));

        assertThatThrownBy(() -> service.ensureNotAlreadyLinked("google", Map.of("sub", "g-1")))
                .isInstanceOf(SsoAlreadyLinkedException.class);
    }

    @Test
    void shouldAllowRegistrationOfUnlinkedIdentity() {
        when(repository.findByProviderAndSubject("google", "g-1")).thenReturn(Optional.empty());

        assertThatCode(() -> service.ensureNotAlreadyLinked("google", Map.of("sub", "g-1"))).doesNotThrowAnyException();
    }

    @Test
    void shouldUpsertLinkKeyedOnProviderSubjectAndUser() {
        when(mongoTemplate.upsert(any(Query.class), any(Update.class), eq(SsoIdentity.class)))
                .thenReturn(UpdateResult.acknowledged(0, 1L, new BsonString("new-id")));

        service.link("microsoft", Map.of("tid", "t-1", "oid", "o-1"), user);

        ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
        ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).upsert(query.capture(), update.capture(), eq(SsoIdentity.class));
        assertThat(query.getValue().getQueryObject())
                .containsEntry("provider", "microsoft")
                .containsEntry("subject", "t-1:o-1")
                .containsEntry("userId", "user-1");
        assertThat(update.getValue().getUpdateObject().get("$setOnInsert", org.bson.Document.class))
                .containsEntry("tenantId", "tenant-1")
                .containsKey("createdAt");
        assertThat(update.getValue().getUpdateObject().get("$set", org.bson.Document.class)).containsKey("lastSeenAt");
    }

    @Test
    void shouldNotWriteLinkWithoutSubject() {
        service.link("microsoft", Map.of("sub", "pairwise-only"), user);

        verify(mongoTemplate, never()).upsert(any(Query.class), any(Update.class), eq(SsoIdentity.class));
    }

    @Test
    void shouldSwallowDuplicateKeyWhenSubjectBelongsToAnotherUser() {
        when(mongoTemplate.upsert(any(Query.class), any(Update.class), eq(SsoIdentity.class)))
                .thenThrow(new DuplicateKeyException("E11000"));

        assertThatCode(() -> service.link("google", Map.of("sub", "g-1"), user)).doesNotThrowAnyException();
    }

    @Test
    void shouldNeverFailLoginWhenLinkWriteFails() {
        when(mongoTemplate.upsert(any(Query.class), any(Update.class), eq(SsoIdentity.class)))
                .thenThrow(new IllegalStateException("mongo down"));

        assertThatCode(() -> service.link("google", Map.of("sub", "g-1"), user)).doesNotThrowAnyException();
    }

    @Test
    void shouldRemoveAllLinksOfUser() {
        service.removeUserLinks("user-1");

        verify(repository).deleteByUserId("user-1");
    }
}
