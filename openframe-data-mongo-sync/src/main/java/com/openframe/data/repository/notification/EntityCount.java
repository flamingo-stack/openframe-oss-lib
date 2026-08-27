package com.openframe.data.repository.notification;

import org.springframework.data.mongodb.core.mapping.Field;

public record EntityCount(
        @Field("_id") String entityId,
        long count) {
}
