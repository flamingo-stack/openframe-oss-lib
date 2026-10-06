package com.openframe.api.relay;

import org.springframework.stereotype.Component;

import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.springframework.util.StringUtils.hasText;

// Byte-for-byte graphql.relay.Relay (URL-safe base64, no padding) without a graphql-java dependency in this lib.
@Component
public class GlobalIdCodec {

    private static final String SEPARATOR = ":";
    private static final Pattern GLOBAL_ID = Pattern.compile("([A-Z][A-Za-z0-9]*):(.*)", Pattern.DOTALL);
    private static final Pattern TRAILING_PADDING = Pattern.compile("=+$");
    private static final Base64.Encoder URL_SAFE_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder URL_SAFE_DECODER = Base64.getUrlDecoder();

    public String encode(NodeType type, String rawId) {
        String plain = type.getGraphqlTypeName() + SEPARATOR + rawId;
        byte[] bytes = plain.getBytes(StandardCharsets.UTF_8);
        return URL_SAFE_ENCODER.encodeToString(bytes);
    }

    public String decode(String id, NodeType expected) {
        if (!hasText(id)) {
            return id;
        }
        return parse(id)
                .map(globalId -> rawIdOf(globalId, expected))
                .orElse(id);
    }

    public List<String> decodeAll(List<String> ids, NodeType expected) {
        if (ids == null) {
            return null;
        }
        return ids.stream()
                .map(id -> decode(id, expected))
                .toList();
    }

    public Optional<ParsedGlobalId> parse(String id) {
        String canonical = toUrlSafeUnpadded(id);
        return decodeUtf8(canonical)
                .map(GLOBAL_ID::matcher)
                .filter(Matcher::matches)
                .map(GlobalIdCodec::toParsedGlobalId);
    }

    private String rawIdOf(ParsedGlobalId globalId, NodeType expected) {
        String expectedName = expected.getGraphqlTypeName();
        if (!globalId.isOfType(expected)) {
            throw new InvalidGlobalIdException("Expected a " + expectedName + " id, got " + globalId.getTypeName());
        }
        if (!hasText(globalId.getRawId())) {
            throw new InvalidGlobalIdException("Empty " + expectedName + " id");
        }
        return globalId.getRawId();
    }

    private static String toUrlSafeUnpadded(String id) {
        String urlSafe = id.replace('+', '-').replace('/', '_');
        return TRAILING_PADDING.matcher(urlSafe).replaceFirst("");
    }

    private static Optional<String> decodeUtf8(String canonical) {
        try {
            byte[] bytes = URL_SAFE_DECODER.decode(canonical);
            ByteBuffer buffer = ByteBuffer.wrap(bytes);
            CharsetDecoder strictUtf8 = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT);
            CharBuffer chars = strictUtf8.decode(buffer);
            return Optional.of(chars.toString());
        } catch (IllegalArgumentException | CharacterCodingException e) {
            return Optional.empty();
        }
    }

    private static ParsedGlobalId toParsedGlobalId(Matcher matcher) {
        String typeName = matcher.group(1);
        String rawId = matcher.group(2);
        return new ParsedGlobalId(typeName, rawId);
    }
}
