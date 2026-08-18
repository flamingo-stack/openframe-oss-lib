package com.openframe.notification.spec;

import lombok.EqualsAndHashCode;
import lombok.Getter;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Getter
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
}
