package com.openframe.test.util;

import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

public class StringUtils {

    public static String extractQueryParam(String url, String paramName) {
        if (url == null || !url.contains("?")) {
            return null;
        }
        String query = url.substring(url.indexOf("?") + 1);
        for (String param : query.split("&")) {
            String[] pair = param.split("=", 2);
            if (pair.length == 2 && decode(pair[0]).equals(paramName)) {
                return decode(pair[1]);
            }
        }
        return null;
    }

    private static String decode(String value) {
        try {
            return URLDecoder.decode(value, StandardCharsets.UTF_8.name());
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException("UTF-8 encoding not supported", e);
        }
    }
}

