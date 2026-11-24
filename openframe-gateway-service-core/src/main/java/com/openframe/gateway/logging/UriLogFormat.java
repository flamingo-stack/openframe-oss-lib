package com.openframe.gateway.logging;

import lombok.AccessLevel;
import lombok.NoArgsConstructor;

import java.net.URI;

@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class UriLogFormat {

    private static final String ABSENT = "-";

    public static String withoutQuery(URI uri) {
        if (uri == null) {
            return ABSENT;
        }
        StringBuilder text = new StringBuilder();
        if (uri.getScheme() != null) {
            text.append(uri.getScheme()).append("://");
        }
        if (uri.getRawAuthority() != null) {
            text.append(uri.getRawAuthority());
        }
        if (uri.getRawPath() != null) {
            text.append(uri.getRawPath());
        }
        return text.toString();
    }
}
