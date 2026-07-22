package com.openframe.data.nats.rmm.util;

import java.util.ArrayList;
import java.util.List;

/**
 * Splits user-supplied script arguments into individual argv tokens before they go
 * on the wire to the agent, which passes them <b>positionally</b> to the interpreter
 * ({@code powershell -File script.ps1 <tokens>}, {@code sh script.sh <tokens>}).
 *
 * <p>Each stored element is tokenized independently and the results are flattened, so
 * a single combined entry like {@code "-Bucket my-value"} becomes two argv tokens
 * {@code ["-Bucket", "my-value"]}. That lets a named parameter bind correctly under
 * PowerShell {@code -File} instead of the name leaking into the value (e.g. a
 * {@code param($Bucket)} script receiving {@code "Bucket my-value"}). An element with
 * no whitespace passes through unchanged (1:1), so already-tokenized lists are untouched.
 *
 * <p>Quoting groups a value that legitimately contains spaces: single or double quotes
 * delimit one token and are stripped from the result
 * ({@code "\"C:\\Program Files\"" -> C:\Program Files}). Backslash is an ordinary
 * character here (NOT a POSIX escape) so Windows paths survive intact.
 */
public final class ScriptArgsTokenizer {

    private ScriptArgsTokenizer() {
    }

    /**
     * Tokenize every element and flatten. {@code null} in → {@code null} out (preserves
     * "no args"); {@code null} / blank / all-whitespace elements contribute nothing.
     */
    public static List<String> tokenize(List<String> args) {
        if (args == null) {
            return null;
        }
        List<String> out = new ArrayList<>();
        for (String arg : args) {
            if (arg != null) {
                splitInto(arg, out);
            }
        }
        return out;
    }

    private static void splitInto(String s, List<String> out) {
        StringBuilder cur = new StringBuilder();
        boolean inToken = false;
        int i = 0;
        int n = s.length();
        while (i < n) {
            char c = s.charAt(i);
            if (c == '\'' || c == '"') {
                // Quoted span: literal content up to the matching quote, appended to the
                // current token so `-Path="C:\Program Files"` stays one token.
                inToken = true;
                char quote = c;
                i++;
                while (i < n && s.charAt(i) != quote) {
                    cur.append(s.charAt(i++));
                }
                if (i < n) {
                    i++; // consume the closing quote
                }
            } else if (Character.isWhitespace(c)) {
                if (inToken) {
                    out.add(cur.toString());
                    cur.setLength(0);
                    inToken = false;
                }
                i++;
            } else {
                inToken = true;
                cur.append(c);
                i++;
            }
        }
        if (inToken) {
            out.add(cur.toString());
        }
    }
}
