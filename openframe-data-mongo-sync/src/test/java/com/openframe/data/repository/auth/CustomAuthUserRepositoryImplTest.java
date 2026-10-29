package com.openframe.data.repository.auth;

import com.openframe.data.document.auth.AuthUser;
import org.bson.Document;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class CustomAuthUserRepositoryImplTest {

    private static final Instant LOGIN = Instant.parse("2026-01-01T00:05:00Z");

    private final MongoTemplate mongoTemplate = mock(MongoTemplate.class);
    private final CustomAuthUserRepositoryImpl repository = new CustomAuthUserRepositoryImpl(mongoTemplate);

    @Test
    @DisplayName("Given a login, when lastLogin is updated, then only that user's lastLogin is set and the version is incremented by 0, so the login never conflicts with an edit of the user")
    void updatesOnlyLastLoginAndKeepsVersion() {
        repository.updateLastLogin("ada@acme.com", "tenant-1", LOGIN);

        ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
        ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).updateFirst(query.capture(), update.capture(), eq(AuthUser.class));
        assertThat(query.getValue().getQueryObject())
                .isEqualTo(new Document("email", "ada@acme.com").append("tenantId", "tenant-1"));
        Document executed = update.getValue().getUpdateObject();
        assertThat(executed.get("$set", Document.class).keySet()).containsExactly("lastLogin");
        assertThat(executed.get("$inc")).isEqualTo(new Document("version", 0));
    }

    @Test
    @DisplayName("Given an uploaded avatar, when the image URL is updated, then only imageUrl is set on that user and Spring keeps its own version increment")
    void updatesOnlyImageUrl() {
        repository.updateImageUrl("user-1", "https://cdn/avatar.png");

        ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
        ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).updateFirst(query.capture(), update.capture(), eq(AuthUser.class));
        assertThat(query.getValue().getQueryObject()).isEqualTo(new Document("_id", "user-1"));
        Document executed = update.getValue().getUpdateObject();
        assertThat(executed.get("$set")).isEqualTo(new Document("imageUrl", "https://cdn/avatar.png"));
        assertThat(executed).doesNotContainKey("$inc");
    }
}
