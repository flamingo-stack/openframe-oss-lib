package com.openframe.api.dto.notification;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class UnreadEntityCount {

    private final String entityId;
    private final long count;
}
