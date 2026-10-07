package com.openframe.graphql.relay;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

import static com.openframe.graphql.relay.NodeType.INSIGHT;
import static com.openframe.graphql.relay.NodeType.KNOWLEDGE_BASE_ITEM;
import static com.openframe.graphql.relay.NodeType.TICKET;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.params.provider.Arguments.arguments;

class RelayIdCodecTest {

    private static final String OBJECT_ID = "665f1c2ab3e4d5f6a7b8c9d0";
    private static final String TICKET_GLOBAL_ID = "VGlja2V0OjY2NWYxYzJhYjNlNGQ1ZjZhN2I4YzlkMA";
    private static final String MACHINE_RAW_ID = "machine-1";
    private static final String MACHINE_GLOBAL_ID = "TWFjaGluZTptYWNoaW5lLTE";
    private static final String PADDED_STANDARD_TICKET_ID = "VGlja2V0Oj8/Pw==";
    private static final String PADDED_STANDARD_RAW_ID = "???";
    private static final String UNPADDED_URL_SAFE_TICKET_ID = "VGlja2V0Oj8_Pw";
    private static final String EMPTY_KEY_TICKET_ID = "VGlja2V0Og";
    private static final String NON_UTF8_BASE64 = "_w";
    private static final String TAG_GLOBAL_ID = "VGFnOnRhZy0x";
    private static final Set<NodeType> ASSIGNABLE_ITEM_TYPES = EnumSet.of(TICKET, KNOWLEDGE_BASE_ITEM, INSIGHT);

    private final RelayIdCodec codec = new RelayIdCodec();

    @ParameterizedTest
    @MethodSource("relayEncodings")
    void encode_rawKey_sameGlobalIdAsGraphqlJavaRelay(NodeType type, String rawKey, String relayGlobalId) {
        // execution
        String encoded = codec.encode(type, rawKey);

        // verifications
        assertThat(encoded).isEqualTo(relayGlobalId);
    }

    @Test
    void encode_rawIdNeedingUrlSafeAlphabet_unpaddedUrlSafe() {
        // execution
        String encoded = codec.encode(TICKET, PADDED_STANDARD_RAW_ID);

        // verifications
        assertThat(encoded).isEqualTo(UNPADDED_URL_SAFE_TICKET_ID);
    }

    @Test
    void decode_globalIdOfExpectedType_returnsRawId() {
        // execution
        String decoded = codec.decode(TICKET_GLOBAL_ID, TICKET);

        // verifications
        assertThat(decoded).isEqualTo(OBJECT_ID);
    }

    @ParameterizedTest
    @ValueSource(strings = {PADDED_STANDARD_TICKET_ID, UNPADDED_URL_SAFE_TICKET_ID})
    void decode_paddedOrUrlSafeAlphabet_returnsRawId(String globalId) {
        // execution
        String decoded = codec.decode(globalId, TICKET);

        // verifications
        assertThat(decoded).isEqualTo(PADDED_STANDARD_RAW_ID);
    }

    @ParameterizedTest
    @ValueSource(strings = {OBJECT_ID, "3f1e9c2a-7b4d-4e8f-9a1b-2c3d4e5f6a7b", MACHINE_RAW_ID, "client-1",
            "abc", "!!!", "12345", NON_UTF8_BASE64, "aGVsbG8", "bWFjaGluZToxMg"})
    void decode_rawId_returnedUnchanged(String rawId) {
        // execution
        String decoded = codec.decode(rawId, TICKET);

        // verifications
        assertThat(decoded).isEqualTo(rawId);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void decode_nullOrBlank_returnedUnchanged(String id) {
        // execution
        String decoded = codec.decode(id, TICKET);

        // verifications
        assertThat(decoded).isEqualTo(id);
    }

    @Test
    void decode_globalIdOfOtherType_throwsInvalidGlobalId() {
        // execution
        InvalidRelayIdException exception = assertThrows(InvalidRelayIdException.class,
                () -> codec.decode(MACHINE_GLOBAL_ID, TICKET));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("Expected a Ticket id, got Machine");
    }

    @Test
    void invalidGlobalIdException_code_invalidId() {
        // execution
        InvalidRelayIdException exception = new InvalidRelayIdException("x");

        // verifications
        assertThat(exception.getCode()).isEqualTo("INVALID_ID");
    }

    @Test
    void decode_globalIdWithEmptyKey_throwsInvalidGlobalId() {
        // execution
        InvalidRelayIdException exception = assertThrows(InvalidRelayIdException.class,
                () -> codec.decode(EMPTY_KEY_TICKET_ID, TICKET));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("Empty Ticket id");
    }

    @Test
    void decodeAll_mixedRawAndGlobalIds_allRaw() {
        // setup
        List<String> ids = List.of(TICKET_GLOBAL_ID, OBJECT_ID);

        // execution
        List<String> decoded = codec.decodeAll(ids, TICKET);

        // verifications
        assertThat(decoded).containsExactly(OBJECT_ID, OBJECT_ID);
    }

    @Test
    void decodeAll_globalIdOfOtherType_throwsInvalidGlobalId() {
        // setup
        List<String> ids = List.of(TICKET_GLOBAL_ID, MACHINE_GLOBAL_ID);

        // execution
        InvalidRelayIdException exception = assertThrows(InvalidRelayIdException.class,
                () -> codec.decodeAll(ids, TICKET));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("Expected a Ticket id, got Machine");
    }

    @Test
    void decodeAll_null_returnsNull() {
        // execution
        List<String> decoded = codec.decodeAll(null, TICKET);

        // verifications
        assertThat(decoded).isNull();
    }

    @ParameterizedTest
    @MethodSource("assignableItemGlobalIds")
    void decodeOneOf_globalIdOfAnyExpectedType_returnsRawId(NodeType type, String rawId) {
        // setup
        String globalId = codec.encode(type, rawId);

        // execution
        String decoded = codec.decodeOneOf(globalId, ASSIGNABLE_ITEM_TYPES);

        // verifications
        assertThat(decoded).isEqualTo(rawId);
    }

    @Test
    void decodeOneOf_rawId_returnedUnchanged() {
        // execution
        String decoded = codec.decodeOneOf(OBJECT_ID, ASSIGNABLE_ITEM_TYPES);

        // verifications
        assertThat(decoded).isEqualTo(OBJECT_ID);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void decodeOneOf_nullOrBlank_returnedUnchanged(String id) {
        // execution
        String decoded = codec.decodeOneOf(id, ASSIGNABLE_ITEM_TYPES);

        // verifications
        assertThat(decoded).isEqualTo(id);
    }

    @Test
    void decodeOneOf_globalIdOfOtherType_throwsListingExpectedTypes() {
        // execution
        InvalidRelayIdException exception = assertThrows(InvalidRelayIdException.class,
                () -> codec.decodeOneOf(TAG_GLOBAL_ID, ASSIGNABLE_ITEM_TYPES));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("Expected a Ticket or KnowledgeBaseItem or Insight id, got Tag");
    }

    @Test
    void decodeOneOf_globalIdWithEmptyKey_throwsEmptyId() {
        // execution
        InvalidRelayIdException exception = assertThrows(InvalidRelayIdException.class,
                () -> codec.decodeOneOf(EMPTY_KEY_TICKET_ID, ASSIGNABLE_ITEM_TYPES));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("Empty Ticket id");
    }

    @Test
    void parse_machineGlobalId_typeNameAndRawId() {
        // execution
        Optional<ParsedRelayId> parsed = codec.parse(MACHINE_GLOBAL_ID);

        // verifications
        assertThat(parsed)
                .get()
                .extracting(ParsedRelayId::getTypeName, ParsedRelayId::getRawId)
                .containsExactly("Machine", MACHINE_RAW_ID);
    }

    @Test
    void parse_rawObjectId_empty() {
        // execution
        Optional<ParsedRelayId> parsed = codec.parse(OBJECT_ID);

        // verifications
        assertThat(parsed).isEmpty();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void parse_nullOrBlank_empty(String id) {
        // execution
        Optional<ParsedRelayId> parsed = codec.parse(id);

        // verifications
        assertThat(parsed).isEmpty();
    }

    @Test
    void parse_nonUtf8Bytes_empty() {
        // execution
        Optional<ParsedRelayId> parsed = codec.parse(NON_UTF8_BASE64);

        // verifications
        assertThat(parsed).isEmpty();
    }

    private static Stream<Arguments> assignableItemGlobalIds() {
        return Stream.of(
                arguments(TICKET, OBJECT_ID),
                arguments(KNOWLEDGE_BASE_ITEM, "kb-1"),
                arguments(INSIGHT, "insight-1"));
    }

    // Produced by graphql.relay.Relay 22 (URL-safe, unpadded), i.e. what api-service-core emits today:
    // Machine <- machineId (DeviceDataFetcher), Ticket <- _id (AssignmentDataFetcher.ticketNodeId), Tag, Organization
    // <- organizationId, User <- _id (encodeNodeOptions).
    private static Stream<Arguments> relayEncodings() {
        return Stream.of(
                arguments(NodeType.MACHINE, MACHINE_RAW_ID, MACHINE_GLOBAL_ID),
                arguments(NodeType.TICKET, OBJECT_ID, TICKET_GLOBAL_ID),
                arguments(NodeType.TAG, "tag-1", "VGFnOnRhZy0x"),
                arguments(NodeType.ORGANIZATION, "org-1", "T3JnYW5pemF0aW9uOm9yZy0x"),
                arguments(NodeType.USER, "user-1", "VXNlcjp1c2VyLTE"),
                arguments(NodeType.DIALOG, "dialog-1", "RGlhbG9nOmRpYWxvZy0x"),
                arguments(NodeType.TICKET_STATUS_DEFINITION, "status-1",
                        "VGlja2V0U3RhdHVzRGVmaW5pdGlvbjpzdGF0dXMtMQ"),
                arguments(NodeType.ITEM_ASSIGNMENT, "assignment-1", "SXRlbUFzc2lnbm1lbnQ6YXNzaWdubWVudC0x"),
                arguments(NodeType.TIME_ENTRY, "entry-1", "VGltZUVudHJ5OmVudHJ5LTE"),
                arguments(NodeType.NOTIFICATION, "notification-1", "Tm90aWZpY2F0aW9uOm5vdGlmaWNhdGlvbi0x"),
                arguments(NodeType.SOFTWARE_SCHEDULE, "schedule-1", "U29mdHdhcmVTY2hlZHVsZTpzY2hlZHVsZS0x"));
    }
}
