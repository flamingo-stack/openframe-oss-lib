package com.openframe.data.repository.notification;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.data.mongodb.core.mapping.Field;

@Getter
@AllArgsConstructor
public class EntityCount {

    @Field("_id")
    private final String entityId;
    private final long count;
}
