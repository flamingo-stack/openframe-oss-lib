package com.openframe.notification.spec;

import lombok.Getter;

import static org.apache.commons.lang3.StringUtils.isBlank;

// The rendered text of one notification; title is mandatory, description may be absent.
@Getter
public final class Composed {

    private final String title;
    private final String description;

    public Composed(String title, String description) {
        if (isBlank(title)) {
            throw new IllegalArgumentException("composed title must not be blank");
        }
        this.title = title;
        this.description = description;
    }
}
