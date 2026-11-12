package com.openframe.audit;

import com.openframe.graphql.relay.ParsedRelayId;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.util.ReflectionUtils;

import java.lang.reflect.Method;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.entry;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditExpressionsTest {

    private static final Method ARCHIVE = ReflectionUtils.findMethod(TicketEndpoints.class, "archive", String.class);
    private static final Method CREATE = ReflectionUtils.findMethod(TicketEndpoints.class, "create", String.class);
    private static final Method ADD_TAG =
            ReflectionUtils.findMethod(TicketEndpoints.class, "addTag", String.class, String.class);
    private static final Method CANCEL_RUN = ReflectionUtils.findMethod(TicketEndpoints.class, "cancelRun", UUID.class);
    private static final Object[] TAG_ARGUMENTS = {"ticket-1", "tag-9"};
    private static final String[] TAG_DETAILS = {"tagId=#tagId", "ticketTitle=#result?.ticket?.title"};
    private static final TicketView TICKET = new TicketView("ticket-1", "Printer offline", "org-1");

    @Mock private RelayIdCodec relayIds;

    private AuditExpressions expressions;

    @BeforeEach
    void setUp() {
        expressions = new AuditExpressions(relayIds);
    }

    @Test
    void readsResult_expressionOverArguments_isFalse() {
        assertThat(expressions.readsResult("#input.ticketId")).isFalse();
    }

    @Test
    void readsResult_expressionOverResult_isTrue() {
        assertThat(expressions.readsResult("#result.ticket.id")).isTrue();
    }

    @Test
    void readsResult_parameterNameStartingWithResult_isFalse() {
        assertThat(expressions.readsResult("#resultId")).isFalse();
    }

    @Test
    void evaluate_parameterName_returnsThatArgument() {
        assertThat(expressions.evaluate("#tagId", ADD_TAG, TAG_ARGUMENTS, null)).isEqualTo("tag-9");
    }

    @Test
    void evaluate_expressionOverResult_returnsTheValueFromTheResult() {
        assertThat(expressions.evaluate("#result.ticket.id", CREATE, new Object[]{"Printer offline"},
                new TicketPayload(TICKET, true))).isEqualTo("ticket-1");
    }

    @Test
    void evaluate_valueIsNull_returnsNull() {
        TicketView withoutCustomer = new TicketView("ticket-1", "Printer offline", null);

        assertThat(expressions.evaluate("#result.ticket.organizationId", CREATE, new Object[]{"Printer offline"},
                new TicketPayload(withoutCustomer, true))).isNull();
    }

    @Test
    void evaluate_valueIsNotText_returnsItsText() {
        UUID runId = UUID.fromString("0b7e1c52-4f0a-4d8e-9a51-2c7d3f6e8a10");

        assertThat(expressions.evaluate("#runId", CANCEL_RUN, new Object[]{runId}, null))
                .isEqualTo("0b7e1c52-4f0a-4d8e-9a51-2c7d3f6e8a10");
    }

    @Test
    void evaluate_rawIdOfGlobalId_returnsTheRawId() {
        when(relayIds.parse("VGlja2V0OnJhdy03")).thenReturn(Optional.of(new ParsedRelayId("Ticket", "raw-7")));

        assertThat(expressions.evaluate("rawId(#id)", ARCHIVE, new Object[]{"VGlja2V0OnJhdy03"}, null))
                .isEqualTo("raw-7");
    }

    @Test
    void evaluate_rawIdOfPlainId_returnsTheIdUnchanged() {
        when(relayIds.parse("671a9e03c2f4")).thenReturn(Optional.empty());

        assertThat(expressions.evaluate("rawId(#id)", ARCHIVE, new Object[]{"671a9e03c2f4"}, null))
                .isEqualTo("671a9e03c2f4");
    }

    @Test
    void test_conditionTrue_returnsTrue() {
        assertThat(expressions.test("#result.changed", ADD_TAG, TAG_ARGUMENTS, new TicketPayload(TICKET, true)))
                .isTrue();
    }

    @Test
    void test_conditionFalse_returnsFalse() {
        assertThat(expressions.test("#result.changed", ADD_TAG, TAG_ARGUMENTS, new TicketPayload(TICKET, false)))
                .isFalse();
    }

    @Test
    void test_conditionNull_returnsFalse() {
        assertThat(expressions.test("#result.changed", ADD_TAG, TAG_ARGUMENTS, new TicketPayload(TICKET, null)))
                .isFalse();
    }

    @Test
    void details_entriesOverArgumentsAndResult_mapsEachKeyToItsValue() {
        assertThat(expressions.details(TAG_DETAILS, ADD_TAG, TAG_ARGUMENTS, new TicketPayload(TICKET, true)))
                .containsOnly(entry("tagId", "tag-9"), entry("ticketTitle", "Printer offline"));
    }

    @Test
    void details_noResult_skipsEntriesReadingResult() {
        assertThat(expressions.details(TAG_DETAILS, ADD_TAG, TAG_ARGUMENTS, null))
                .containsOnly(entry("tagId", "tag-9"));
    }

    @Test
    void details_spacesAroundSeparator_trimsTheKey() {
        assertThat(expressions.details(new String[]{" tagId = #tagId "}, ADD_TAG, TAG_ARGUMENTS, null))
                .containsOnly(entry("tagId", "tag-9"));
    }

    @Test
    void details_oneExpressionFails_keepsTheOtherDetails() {
        String[] failingFirst = {"ticketTitle=#result.ticket.title", "tagId=#tagId"};

        assertThat(expressions.details(failingFirst, ADD_TAG, TAG_ARGUMENTS, new TicketPayload(null, false)))
                .containsOnly(entry("tagId", "tag-9"));
    }

    record TicketView(String id, String title, String organizationId) {
    }

    record TicketPayload(TicketView ticket, Boolean changed) {
    }

    static class TicketEndpoints {

        String archive(String id) {
            return id;
        }

        TicketPayload create(String title) {
            return null;
        }

        TicketPayload addTag(String ticketId, String tagId) {
            return null;
        }

        void cancelRun(UUID runId) {
        }
    }
}
