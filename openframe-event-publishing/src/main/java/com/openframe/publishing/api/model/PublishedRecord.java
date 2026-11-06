package com.openframe.publishing.api.model;

import com.openframe.publishing.api.spec.PublishedEvent;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

// What a consumer receives for each outbox row: the event with the fields every consumer needs; event is null on a delete.
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublishedRecord<E extends PublishedEvent> {

    // What this build writes and can read; a consumer refuses a newer one.
    public static final int CURRENT_SCHEMA_VERSION = 1;

    private String tenantId;
    private long version;
    private boolean deleted;
    private int schemaVersion;
    private E event;
}
