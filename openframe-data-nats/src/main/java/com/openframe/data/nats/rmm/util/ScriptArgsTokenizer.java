package com.openframe.data.nats.rmm.util;

import java.util.ArrayList;
import java.util.List;

/**
 * Splits user-supplied script arguments into individual argv tokens before they go
 * on the wire to the agent, which passes them <b>positionally</b> to the interpreter
 * ({@code powershell -File script.ps1 <tokens>}, {@code sh script.sh <tokens>}).
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
