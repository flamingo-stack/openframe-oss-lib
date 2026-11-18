package com.openframe.data.mapper;

import com.github.f4b6a3.ulid.Ulid;
import com.openframe.data.document.audit.AuditEvent;
import com.openframe.data.model.audit.AuditActor;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.model.audit.AuditRequestInfo;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TimeZone;
import java.util.UUID;

import static com.openframe.data.document.audit.AuditAction.TICKET_ARCHIVE;
import static com.openframe.data.document.audit.AuditOutcome.SUCCESS;
import static com.openframe.data.document.audit.AuditTargetType.KB_ARTICLE;
import static com.openframe.data.document.audit.AuditTargetType.TICKET;
import static org.assertj.core.api.Assertions.assertThat;

class AuditEventMapperTest {

    private static final AuditRequestInfo NO_REQUEST = new AuditRequestInfo(null, null, null, null);
    private static final Instant OCCURRED_AT = Instant.parse("2026-10-28T14:12:00Z");

    private final AuditEventMapper mapper = new AuditEventMapperImpl();

    @Test
    void toEvent_entryWithoutId_mintsUlid() {
        AuditEvent event = eventOf(ticketArchive().build());

        assertThat(Ulid.isValid(event.getId())).isTrue();
    }

    @Test
    void toEvent_entryWithId_keepsEntryId() {
        AuditEvent event = eventOf(ticketArchive().id("01JC4X2Q7V9M3T8R5N6P1K0W2Z").build());

        assertThat(event.getId()).isEqualTo("01JC4X2Q7V9M3T8R5N6P1K0W2Z");
    }

    @Test
    void toEvent_entryNamesNoTargetType_takesActionTargetType() {
        AuditEvent event = eventOf(ticketArchive().build());

        assertThat(event.getTargetType()).isEqualTo(TICKET);
    }

    @Test
    void toEvent_entryNamesTargetType_takesItOverActionTargetType() {
        AuditEvent event = eventOf(ticketArchive().targetType(KB_ARTICLE).build());

        assertThat(event.getTargetType()).isEqualTo(KB_ARTICLE);
    }

    @Test
    void toEvent_detailWithoutValue_storesOnlyTheDetailsWithValues() {
        Map<String, Object> details = new HashMap<>();
        details.put("tagIds", null);
        details.put("via", "dialog");

        AuditEvent event = eventOf(ticketArchive().details(details).build());

        assertThat(event.getDetails()).isEqualTo(Map.of("via", "dialog"));
    }

    @Test
    void toEvent_noDetailHasAValue_storesNoDetails() {
        Map<String, Object> details = new HashMap<>();
        details.put("tagIds", null);

        AuditEvent event = eventOf(ticketArchive().details(details).build());

        assertThat(event.getDetails()).isNull();
    }

    @Test
    void toEvent_detailsOfSimpleValuesAndListsOfThem_storesThemAll() {
        Map<String, Object> details = Map.of("via", "dialog", "count", 2, "forced", true,
                "tagIds", List.of("tag-1", "tag-2"));

        AuditEvent event = eventOf(ticketArchive().details(details).build());

        assertThat(event.getDetails()).isEqualTo(details);
    }

    @Test
    void toEvent_detailsThatAreNotTextNumberOrYesNo_storesThemAsText() {
        Map<String, Object> details = Map.of(
                "status", SUCCESS,
                "dueAt", OffsetDateTime.parse("2026-10-28T14:12:00+02:00"),
                "at", OCCURRED_AT,
                "runId", UUID.fromString("0b7e1c52-4f0a-4d8e-9a51-2c7d3f6e8a10"),
                "recordId", new ObjectId("671a9e03c2f4a1b2c3d4e5f6"),
                "title", new StringBuilder("Printer offline"));

        AuditEvent event = eventOf(ticketArchive().details(details).build());

        assertThat(event.getDetails()).isEqualTo(Map.of(
                "status", "SUCCESS",
                "dueAt", "2026-10-28T14:12+02:00",
                "at", "2026-10-28T14:12:00Z",
                "runId", "0b7e1c52-4f0a-4d8e-9a51-2c7d3f6e8a10",
                "recordId", "671a9e03c2f4a1b2c3d4e5f6",
                "title", "Printer offline"));
    }

    @Test
    void toEvent_detailsOfLargeNumbersDatesAndZones_storesThemAsText() {
        Map<String, Object> details = Map.of(
                "cap", new BigDecimal("10.000000000000000000000000000000001"),
                "rate", new BigDecimal("1E+1"),
                "count", new BigInteger("123456789012345678901234567890123456789"),
                "sentAt", Date.from(OCCURRED_AT),
                "zone", TimeZone.getTimeZone("Europe/Berlin"));

        AuditEvent event = eventOf(ticketArchive().details(details).build());

        assertThat(event.getDetails()).isEqualTo(Map.of(
                "cap", "10.000000000000000000000000000000001",
                "rate", "10",
                "count", "123456789012345678901234567890123456789",
                "sentAt", "2026-10-28T14:12:00Z",
                "zone", "Europe/Berlin"));
    }

    @Test
    void toEvent_detailsThatAreEmptyListsOrHoldOnlyEmptyPlaces_storesNoDetails() {
        Map<String, Object> details = Map.of("tagIds", List.of(), "ownerIds", Arrays.asList(null, null));

        AuditEvent event = eventOf(ticketArchive().details(details).build());

        assertThat(event.getDetails()).isNull();
    }

    @Test
    void toEvent_detailThatIsAListWithAnEmptyPlace_storesTheListWithoutIt() {
        Map<String, Object> details = Map.of("tagIds", Arrays.asList("tag-1", null, "tag-2"));

        AuditEvent event = eventOf(ticketArchive().details(details).build());

        assertThat(event.getDetails()).isEqualTo(Map.of("tagIds", List.of("tag-1", "tag-2")));
    }

    @Test
    void toEvent_detailThatIsAMapOrAListOfLists_storesOnlyTheOtherDetails() {
        Map<String, Object> details = Map.of("via", "dialog", "input", Map.of("password", "s3cret"),
                "pairs", List.of(List.of("a", "b")));

        AuditEvent event = eventOf(ticketArchive().details(details).build());

        assertThat(event.getDetails()).isEqualTo(Map.of("via", "dialog"));
    }

    private AuditEvent eventOf(AuditEntry entry) {
        return mapper.toEvent(entry, AuditActor.system(), NO_REQUEST, "tenant-1", null, OCCURRED_AT);
    }

    private static AuditEntry.AuditEntryBuilder ticketArchive() {
        return AuditEntry.builder().action(TICKET_ARCHIVE).outcome(SUCCESS);
    }
}
