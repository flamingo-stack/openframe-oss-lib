package com.openframe.core.clientversion;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.openframe.core.clientversion.ClientIdentity.UNKNOWN_VERSION;

public final class ClientIdentityParser {

    private static final Pattern HEADER = Pattern.compile("^([a-z]+)/(\\S+) bundle/(\\S+)$");
    private static final Pattern VERSION = Pattern.compile("^[0-9A-Za-z.-]{1,32}$");

    private ClientIdentityParser() {
    }

    public static ClientIdentity parse(String header) {
        if (header == null) {
            return ClientIdentity.unknown();
        }
        Matcher matcher = HEADER.matcher(header.trim());
        if (!matcher.matches()) {
            return ClientIdentity.unknown();
        }
        ClientKind kind = ClientKind.fromLabel(matcher.group(1));
        String shellVersion = sanitizeVersion(matcher.group(2));
        String bundleVersion = sanitizeVersion(matcher.group(3));
        return new ClientIdentity(kind, shellVersion, bundleVersion);
    }

    private static String sanitizeVersion(String version) {
        boolean valid = VERSION.matcher(version).matches();
        return valid ? version : UNKNOWN_VERSION;
    }
}
