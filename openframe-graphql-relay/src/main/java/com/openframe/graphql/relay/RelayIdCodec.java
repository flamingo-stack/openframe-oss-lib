package com.openframe.graphql.relay;


import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.springframework.util.StringUtils.hasText;

// Byte-for-byte graphql.relay.Relay (URL-safe base64, no padding), usable without graphql-java on the classpath.
public class RelayIdCodec {

    private static final String SEPARATOR = ":";
    private static final String TYPE_NAME_DELIMITER = " or ";
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
        Set<NodeType> expectedTypes = EnumSet.of(expected);
        return decodeOneOf(id, expectedTypes);
    }

    public String decodeOneOf(String id, Set<NodeType> expected) {
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

    public Optional<ParsedRelayId> parse(String id) {
        if (!hasText(id)) {
            return Optional.empty();
        }
        String canonical = toUrlSafeUnpadded(id);
        return decodeUtf8(canonical)
                .map(GLOBAL_ID::matcher)
                .filter(Matcher::matches)
                .map(RelayIdCodec::toParsedRelayId);
    }

    private String rawIdOf(ParsedRelayId globalId, Set<NodeType> expected) {
        String actualTypeName = globalId.getTypeName();
        String rawId = globalId.getRawId();
        if (!isOfAnyType(globalId, expected)) {
            String expectedNames = joinTypeNames(expected);
            throw new InvalidRelayIdException("Expected a " + expectedNames + " id, got " + actualTypeName);
        }
        if (!hasText(rawId)) {
            throw new InvalidRelayIdException("Empty " + actualTypeName + " id");
        }
        return rawId;
    }

    private static boolean isOfAnyType(ParsedRelayId globalId, Set<NodeType> types) {
        return types.stream().anyMatch(globalId::isOfType);
    }

    private static String joinTypeNames(Set<NodeType> types) {
        return types.stream()
                .map(NodeType::getGraphqlTypeName)
                .collect(Collectors.joining(TYPE_NAME_DELIMITER));
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
            String decoded = chars.toString();
            return Optional.of(decoded);
        } catch (IllegalArgumentException | CharacterCodingException e) {
            return Optional.empty();
        }
    }

    private static ParsedRelayId toParsedRelayId(Matcher matcher) {
        String typeName = matcher.group(1);
        String rawId = matcher.group(2);
        return new ParsedRelayId(typeName, rawId);
    }
}
