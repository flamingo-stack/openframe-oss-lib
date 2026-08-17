package com.openframe.notification.spec;

import lombok.EqualsAndHashCode;

import static org.apache.commons.lang3.StringUtils.isBlank;

// Producers and specs reference attributes only through these constants — never string literals.
@EqualsAndHashCode
public final class AttrKey {

    private final String name;

    private AttrKey(String name) {
        if (isBlank(name)) {
            throw new IllegalArgumentException("attribute key name must not be blank");
        }
        this.name = name;
    }

    public static AttrKey of(String name) {
        return new AttrKey(name);
    }

    public String name() {
        return name;
    }
}
