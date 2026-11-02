package com.openframe.data.service.machine;

import static org.springframework.util.StringUtils.hasText;

// the openframe client's version as it reports it: dotted numbers, a suffix after a number is ignored
public final class AgentVersion {

    private AgentVersion() {
    }

    public static boolean isAtLeast(String actual, String min) {
        if (!hasText(actual)) {
            return false;
        }
        if (!hasText(min)) {
            return true;
        }
        return compare(actual, min) >= 0;
    }

    private static int compare(String a, String b) {
        String[] pa = a.split("\\.");
        String[] pb = b.split("\\.");
        int n = Math.max(pa.length, pb.length);
        for (int i = 0; i < n; i++) {
            int va = part(pa, i);
            int vb = part(pb, i);
            if (va != vb) {
                return Integer.compare(va, vb);
            }
        }
        return 0;
    }

    private static int part(String[] parts, int i) {
        if (i >= parts.length) {
            return 0;
        }
        try {
            return Integer.parseInt(parts[i].replaceAll("\\D.*$", ""));
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
