package com.openframe.api.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

// Published after a tag and its assignments are removed, for what other modules keep per tag, such as insight check settings.
@Getter
public class TagDeletedEvent extends ApplicationEvent {

    private final String tenantId;
    private final String tagId;

    public TagDeletedEvent(Object source, String tenantId, String tagId) {
        super(source);
        this.tenantId = tenantId;
        this.tagId = tagId;
    }
}
