package com.openframe.core.clientversion;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Arrays;

@Getter
@AllArgsConstructor
public enum ClientKind {
    WEB("web", false),
    IOS("ios", true),
    ANDROID("android", true),
    DESKTOP("desktop", false),
    CHAT("chat", false),
    UNKNOWN("unknown", false);

    private final String label;
    private final boolean mobile;

    public static ClientKind fromLabel(String label) {
        return Arrays.stream(values())
                .filter(kind -> kind.label.equals(label))
                .findFirst()
                .orElse(UNKNOWN);
    }
}
