package com.openframe.delivery.dispatch;

import lombok.experimental.UtilityClass;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.regex.Pattern;

@UtilityClass
class AgentVersion {

    private final Pattern NON_DIGITS = Pattern.compile("\\D+");

    boolean isAtLeast(String version, String minimum) {
        long[] actual = numbers(version);
        long[] required = numbers(minimum);
        int length = Math.max(actual.length, required.length);
        for (int i = 0; i < length; i++) {
            long left = numberAt(actual, i);
            long right = numberAt(required, i);
            if (left != right) {
                return left > right;
            }
        }
        return true;
    }

    private long[] numbers(String version) {
        String[] tokens = NON_DIGITS.split(version);
        return Arrays.stream(tokens)
                .filter(StringUtils::hasText)
                .mapToLong(Long::parseLong)
                .toArray();
    }

    private long numberAt(long[] numbers, int index) {
        if (index >= numbers.length) {
            return 0;
        }
        return numbers[index];
    }
}
