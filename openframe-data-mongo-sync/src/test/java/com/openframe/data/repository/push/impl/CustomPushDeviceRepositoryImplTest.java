package com.openframe.data.repository.push.impl;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.push.PushDevice;
import com.openframe.data.document.push.PushPlatform;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import org.bson.BsonObjectId;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CustomPushDeviceRepositoryImplTest {

    private TenantAwareMongoTemplate mongoTemplate;
    private CustomPushDeviceRepositoryImpl repository;

    @BeforeEach
    void setUp() {
        mongoTemplate = mock(TenantAwareMongoTemplate.class);
        repository = new CustomPushDeviceRepositoryImpl(mongoTemplate);
    }

    @Test
    @DisplayName("Given the token is new, when registerToken is called, then it reports the device as created and the filter matches on the token alone — the tenant is added by the template, and MongoDB seeds the inserted row from those equality conditions")
    void new_token_is_created_and_filtered_by_token_only() {
        UpdateResult inserted = upserted();
        when(mongoTemplate.upsert(any(Query.class), any(Update.class), eq(PushDevice.class)))
                .thenReturn(inserted);

        assertThat(repository.registerToken("alice", "tok-1", PushPlatform.ANDROID)).isTrue();

        ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).upsert(query.capture(), any(Update.class), eq(PushDevice.class));
        assertThat(query.getValue().getQueryObject().toJson()).contains("tok-1");
    }

    @Test
    @DisplayName("Given the token already exists (a phone handed to another user after logout), when registerToken is called, then the update SETS userId to the caller rather than only-on-insert — otherwise the previous owner would keep receiving pushes on a device that is no longer theirs")
    void existing_token_is_reassociated_to_the_caller() {
        UpdateResult updated = matchedAndUpdated();
        when(mongoTemplate.upsert(any(Query.class), any(Update.class), eq(PushDevice.class)))
                .thenReturn(updated);

        assertThat(repository.registerToken("bob", "tok-1", PushPlatform.ANDROID)).isFalse();

        ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).upsert(any(Query.class), update.capture(), eq(PushDevice.class));
        String set = update.getValue().getUpdateObject().get("$set").toString();
        assertThat(set).contains("userId=bob");
    }

    @Test
    @DisplayName("Given two registrations of the same token race and one loses the insert on the unique index, when registerToken is called, then it settles with a plain update rather than a second upsert — retrying the upsert would just race again, and the winner's row exists by then")
    void lost_insert_race_settles_with_a_plain_update() {
        UpdateResult claimed = matchedAndUpdated();
        when(mongoTemplate.upsert(any(Query.class), any(Update.class), eq(PushDevice.class)))
                .thenThrow(new DuplicateKeyException("E11000 duplicate key"));
        when(mongoTemplate.updateFirst(any(Query.class), any(Update.class), eq(PushDevice.class)))
                .thenReturn(claimed);

        assertThat(repository.registerToken("alice", "tok-1", PushPlatform.IOS)).isFalse();

        verify(mongoTemplate, times(1)).upsert(any(Query.class), any(Update.class), eq(PushDevice.class));
        verify(mongoTemplate).updateFirst(any(Query.class), any(Update.class), eq(PushDevice.class));
    }

    @Test
    @DisplayName("Given the row that won the insert race is deleted before we can claim it (a concurrent logout), when registerToken is called, then it inserts instead of returning silently — otherwise the registration would be dropped and the device would never receive a push")
    void registration_is_not_lost_if_the_winning_row_disappears() {
        UpdateResult nothingMatched = matchedNothing();
        UpdateResult inserted = upserted();
        when(mongoTemplate.upsert(any(Query.class), any(Update.class), eq(PushDevice.class)))
                .thenThrow(new DuplicateKeyException("E11000 duplicate key"))
                .thenReturn(inserted);
        when(mongoTemplate.updateFirst(any(Query.class), any(Update.class), eq(PushDevice.class)))
                .thenReturn(nothingMatched);

        assertThat(repository.registerToken("alice", "tok-1", PushPlatform.IOS)).isTrue();

        verify(mongoTemplate, times(2)).upsert(any(Query.class), any(Update.class), eq(PushDevice.class));
    }

    private static UpdateResult upserted() {
        UpdateResult result = mock(UpdateResult.class);
        when(result.getUpsertedId()).thenReturn(new BsonObjectId(new ObjectId()));
        return result;
    }

    private static UpdateResult matchedAndUpdated() {
        UpdateResult result = mock(UpdateResult.class);
        when(result.getUpsertedId()).thenReturn(null);
        when(result.getMatchedCount()).thenReturn(1L);
        return result;
    }

    private static UpdateResult matchedNothing() {
        UpdateResult result = mock(UpdateResult.class);
        when(result.getMatchedCount()).thenReturn(0L);
        return result;
    }
}
