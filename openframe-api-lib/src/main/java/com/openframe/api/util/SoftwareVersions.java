package com.openframe.api.util;

import lombok.experimental.UtilityClass;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@UtilityClass
public class SoftwareVersions {

    private static final Pattern LEADING_DIGITS = Pattern.compile("^\\d{1,18}");

    // Numeric, segment-wise version order so "9.0" precedes "10.0" (plain String sort would not).
    public static int compare(String a, String b) {
        String[] pa = a.split("\\.");
        String[] pb = b.split("\\.");
        for (int i = 0; i < Math.max(pa.length, pb.length); i++) {
            long va = i < pa.length ? parseSegment(pa[i]) : 0;
            long vb = i < pb.length ? parseSegment(pb[i]) : 0;
            if (va != vb) {
                return Long.compare(va, vb);
            }
        }
        return a.compareTo(b);
    }

    // the leading number of a segment, so "3-beta" and "0_2" still count as 3 and 0
    private static long parseSegment(String segment) {
        Matcher digits = LEADING_DIGITS.matcher(segment.trim());
        return digits.find() ? Long.parseLong(digits.group()) : 0;
    }
}
