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
    @DisplayName("Given the token is new, when registerToken is called, then it reports the device as created")
    void new_token_is_created() {
        UpdateResult inserted = upserted();
        when(mongoTemplate.upsert(any(Query.class), any(Update.class), eq(PushDevice.class)))
                .thenReturn(inserted);

        assertThat(repository.registerToken("alice", "tok-1", PushPlatform.ANDROID)).isTrue();
    }

    @Test
    @DisplayName("Given the token already exists (a phone handed to another user after logout), when registerToken is called, then it is re-associated rather than duplicated — the previous user must stop receiving pushes on that device")
    void existing_token_is_reassociated_not_duplicated() {
        UpdateResult updated = matchedAndUpdated();
        when(mongoTemplate.upsert(any(Query.class), any(Update.class), eq(PushDevice.class)))
                .thenReturn(updated);

        assertThat(repository.registerToken("bob", "tok-1", PushPlatform.ANDROID)).isFalse();
        verify(mongoTemplate, times(1)).upsert(any(Query.class), any(Update.class), eq(PushDevice.class));
    }

    @Test
    @DisplayName("Given two registrations of the same token race and one loses the insert on the unique index, when registerToken is called, then it settles with a plain update rather than a second upsert — retrying the upsert would just race again, and the row provably exists by then")
    void lost_insert_race_settles_with_a_plain_update_not_another_upsert() {
        when(mongoTemplate.upsert(any(Query.class), any(Update.class), eq(PushDevice.class)))
                .thenThrow(new DuplicateKeyException("E11000 duplicate key"));

        assertThat(repository.registerToken("alice", "tok-1", PushPlatform.IOS)).isFalse();

        verify(mongoTemplate, times(1)).upsert(any(Query.class), any(Update.class), eq(PushDevice.class));
        verify(mongoTemplate).updateFirst(any(Query.class), any(Update.class), eq(PushDevice.class));
    }

    private static UpdateResult upserted() {
        UpdateResult result = mock(UpdateResult.class);
        when(result.getUpsertedId()).thenReturn(new BsonObjectId(new ObjectId()));
        return result;
    }

    private static UpdateResult matchedAndUpdated() {
        UpdateResult result = mock(UpdateResult.class);
        when(result.getUpsertedId()).thenReturn(null);
        return result;
    }
}
