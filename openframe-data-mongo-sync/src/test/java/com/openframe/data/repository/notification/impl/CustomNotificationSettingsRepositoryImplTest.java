package com.openframe.data.repository.notification.impl;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.notification.NotificationSettingGroup;
import com.openframe.data.document.notification.NotificationSettings;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
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
    @DisplayName("saveSettings upserts by userId (the template adds the tenant), mirrors enabled into legacy pushEnabled and sets createdAt only on insert")
    void save_upserts_and_mirrors_the_legacy_field() {
        when(mongoTemplate.upsert(any(Query.class), any(Update.class), eq(NotificationSettings.class)))
                .thenReturn(mock(UpdateResult.class));

        repository.saveSettings("alice", false, Map.of(NotificationSettingGroup.MINGO_MESSAGES, false));

        ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
        ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).upsert(query.capture(), update.capture(), eq(NotificationSettings.class));
        assertThat(query.getValue().getQueryObject().toJson()).contains("alice");
        String set = update.getValue().getUpdateObject().get("$set").toString();
        assertThat(set).contains("enabled=false").contains("pushEnabled=false").contains("typeSettings");
        assertThat(update.getValue().getUpdateObject().get("$setOnInsert").toString()).contains("createdAt");
    }

    @Test
    @DisplayName("Given a legacy master-only write (null typeSettings), when saved, then the stored group overrides are NOT touched")
    void null_type_settings_keeps_stored_overrides() {
        when(mongoTemplate.upsert(any(Query.class), any(Update.class), eq(NotificationSettings.class)))
                .thenReturn(mock(UpdateResult.class));

        repository.saveSettings("alice", true, null);

        ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).upsert(any(Query.class), update.capture(), eq(NotificationSettings.class));
        assertThat(update.getValue().getUpdateObject().get("$set").toString()).doesNotContain("typeSettings");
    }

    @Test
    @DisplayName("Given two saves race and one loses the insert on the unique index, when saveSettings is called, then it settles with a plain update instead of surfacing the exception — the row exists by then")
    void lost_insert_race_settles_with_a_plain_update() {
        when(mongoTemplate.upsert(any(Query.class), any(Update.class), eq(NotificationSettings.class)))
                .thenThrow(new DuplicateKeyException("E11000 duplicate key"));

        repository.saveSettings("alice", false, null);

        verify(mongoTemplate).updateFirst(any(Query.class), any(Update.class), eq(NotificationSettings.class));
    }
}
