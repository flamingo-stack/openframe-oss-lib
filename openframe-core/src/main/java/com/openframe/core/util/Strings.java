package com.openframe.core.util;

import lombok.experimental.UtilityClass;
import org.springframework.util.StringUtils;

import java.util.Locale;

@UtilityClass
public class Strings {

    public static String lowerTrimmed(String value) {
        return StringUtils.hasText(value) ? value.trim().toLowerCase(Locale.ROOT) : null;
    }
}
