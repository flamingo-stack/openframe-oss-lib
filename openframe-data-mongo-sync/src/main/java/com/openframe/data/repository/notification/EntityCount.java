package com.openframe.data.repository.notification;

import org.springframework.data.mongodb.core.mapping.Field;

// A record on purpose — mirrors CategoryCount, whose '_id' binding is proven.
public record EntityCount(
        @Field("_id") String entityId,
        long count) {
}
