package com.openframe.kafka.model.redaction;

import tools.jackson.databind.util.StdConverter;

import java.util.regex.Pattern;

public final class OpenFrameSecretRedactor extends StdConverter<String, String> {

    // PowerShell can wrap a quoted value onto an indented continuation line.
    private static final Pattern SECRET_VALUE = Pattern.compile("""
            (?<prefix>
                (?<!\\S) --openframe-secret (?=[\\t\\x20\\r\\n=])
                [\\t\\x20]*+ (?: = [\\t\\x20]*+ | (?! = | -- ) )
                (?: \\R [\\t\\x20]++ (?=["']) )?+
            )
            (?:
                (?<doubleQuote> ")
                    (?: [^"\\\\\\r\\n]++ | "" | \\\\ (?: \\R [\\t\\x20]++ )*+ [^\\r\\n]?+
                        | \\R [\\t\\x20]++ )++
              | (?<singleQuote> ')
                    (?: [^'\\r\\n]++ | '' | \\R [\\t\\x20]++ )++
              | [^"'\\p{javaWhitespace}] [^\\p{javaWhitespace}]*+
            )
            """, Pattern.CASE_INSENSITIVE | Pattern.COMMENTS);

    @Override
    public String convert(String value) {
        return SECRET_VALUE.matcher(value).replaceAll("${prefix}${doubleQuote}${singleQuote}[REDACTED]");
    }
}
