package com.openframe.data.repository.notification.impl;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.notification.NotificationSettings;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CustomNotificationSettingsRepositoryImplTest {

    private TenantAwareMongoTemplate mongoTemplate;
    private CustomNotificationSettingsRepositoryImpl repository;

    @BeforeEach
    void setUp() {
        mongoTemplate = mock(TenantAwareMongoTemplate.class);
        repository = new CustomNotificationSettingsRepositoryImpl(mongoTemplate);
    }

    @Test
    @DisplayName("Given a user with no settings document, when push is disabled, then the upsert filters on userId alone (the template adds the tenant, and MongoDB seeds the inserted row from those equality conditions) and createdAt is set only on insert")
    void disabling_push_upserts_by_user_id() {
        when(mongoTemplate.upsert(any(Query.class), any(Update.class), eq(NotificationSettings.class)))
                .thenReturn(mock(UpdateResult.class));

        repository.setPushEnabled("alice", false);

        ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
        ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).upsert(query.capture(), update.capture(), eq(NotificationSettings.class));
        assertThat(query.getValue().getQueryObject().toJson()).contains("alice");
        assertThat(update.getValue().getUpdateObject().get("$set").toString()).contains("pushEnabled=false");
        assertThat(update.getValue().getUpdateObject().get("$setOnInsert").toString()).contains("createdAt");
    }

    @Test
    @DisplayName("Given two toggles race and one loses the insert on the unique index, when setPushEnabled is called, then it settles with a plain update instead of surfacing the exception — the row exists by then")
    void lost_insert_race_settles_with_a_plain_update() {
        when(mongoTemplate.upsert(any(Query.class), any(Update.class), eq(NotificationSettings.class)))
                .thenThrow(new DuplicateKeyException("E11000 duplicate key"));

        repository.setPushEnabled("alice", false);

        verify(mongoTemplate).updateFirst(any(Query.class), any(Update.class), eq(NotificationSettings.class));
    }

    @Test
    @DisplayName("Given an empty audience, when disabled users are looked up, then no query is issued at all")
    void empty_audience_issues_no_query() {
        assertThat(repository.findPushDisabledUserIds(List.of())).isEmpty();

        verify(mongoTemplate, never()).find(any(Query.class), eq(NotificationSettings.class));
    }

    @Test
    @DisplayName("Given some users disabled push, when the audience is checked, then only rows with pushEnabled=false are queried and their userIds returned — a user without a document is enabled by default")
    void only_explicitly_disabled_users_are_returned() {
        NotificationSettings muted = NotificationSettings.builder().userId("u1").pushEnabled(false).build();
        when(mongoTemplate.find(any(Query.class), eq(NotificationSettings.class))).thenReturn(List.of(muted));

        Set<String> disabled = repository.findPushDisabledUserIds(List.of("u1", "u2"));

        assertThat(disabled).containsExactly("u1");
        ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).find(query.capture(), eq(NotificationSettings.class));
        assertThat(query.getValue().getQueryObject().toJson()).contains("pushEnabled").contains("false");
    }

    @Test
    @DisplayName("findByUserId returns the document when present and empty when absent")
    void find_by_user_id_wraps_the_single_document() {
        NotificationSettings settings = NotificationSettings.builder().userId("alice").build();
        when(mongoTemplate.findOne(any(Query.class), eq(NotificationSettings.class)))
                .thenReturn(settings)
                .thenReturn(null);

        assertThat(repository.findByUserId("alice")).contains(settings);
        assertThat(repository.findByUserId("ghost")).isEmpty();
    }
}
