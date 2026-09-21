package com.openframe.test.util;

import java.util.Optional;

public class StringUtils {

    public static Optional<String> extractQueryParam(String url, String paramName) {
        if (url == null || !url.contains("?")) {
            return Optional.empty();
        }
        String query = url.substring(url.indexOf("?") + 1);
        for (String param : query.split("&")) {
            String[] pair = param.split("=", 2);
            if (pair.length == 2 && pair[0].equals(paramName)) {
                return Optional.of(pair[1]);
            }
        }
        return Optional.empty();
    }
}

