package com.openframe.notification.spec;

import static org.apache.commons.lang3.StringUtils.isBlank;

/** The rendered text of one notification; title is mandatory, description may be absent. */
public record Composed(String title, String description) {

    public Composed {
        if (isBlank(title)) {
            throw new IllegalArgumentException("composed title must not be blank");
        }
    }
}
