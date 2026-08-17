package com.openframe.notification.spec;

import static org.apache.commons.lang3.StringUtils.isBlank;

/** Producers and specs reference attributes only through these constants — never string literals. */
public record AttrKey(String name) {

    public AttrKey {
        if (isBlank(name)) {
            throw new IllegalArgumentException("attribute key name must not be blank");
        }
    }

    public static AttrKey of(String name) {
        return new AttrKey(name);
    }
}
