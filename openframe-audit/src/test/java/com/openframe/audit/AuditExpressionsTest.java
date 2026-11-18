package com.openframe.audit;

import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.Test;
import org.springframework.util.ReflectionUtils;

import java.lang.reflect.Method;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.entry;

class AuditExpressionsTest {

    private static final Method ARCHIVE = ReflectionUtils.findMethod(TicketEndpoints.class, "archive", String.class);
    private static final Method CREATE = ReflectionUtils.findMethod(TicketEndpoints.class, "create", String.class);
    private static final Method ADD_TAG =
            ReflectionUtils.findMethod(TicketEndpoints.class, "addTag", String.class, String.class);
    private static final Method ARCHIVE_ALL = ReflectionUtils.findMethod(TicketEndpoints.class, "archiveAll", List.class);
    private static final Object[] TAG_ARGUMENTS = {"ticket-1", "tag-9"};
    private static final String[] TAG_DETAILS = {"tagId=#tagId", "ticketTitle=#result?.ticket?.title"};
    private static final TicketView TICKET = new TicketView("ticket-1", "Printer offline", "org-1");

    private final AuditExpressions expressions = new AuditExpressions(new RelayIdCodec());

    @Test
    void isFromResult_expressionOverArguments_isFalse() {
        assertThat(expressions.isFromResult("#input.ticketId")).isFalse();
    }

    @Test
    void isFromResult_expressionOverResult_isTrue() {
        assertThat(expressions.isFromResult("#result.ticket.id")).isTrue();
    }

    @Test
    void isFromResult_parameterNameStartingWithResult_isFalse() {
        assertThat(expressions.isFromResult("#resultId")).isFalse();
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
    void evaluate_expressionOverResultWithoutResult_returnsNull() {
        assertThat(expressions.evaluate("#result.ticket.id", CREATE, new Object[]{"Printer offline"}, null)).isNull();
    }

    @Test
    void evaluate_valueIsANumber_returnsItsText() {
        assertThat(expressions.evaluate("#result", CREATE, new Object[]{"Printer offline"}, 42)).isEqualTo("42");
    }

    @Test
    void evaluate_valueIsAWholeRecord_throws() {
        assertThatThrownBy(() -> expressions.evaluate("#result.ticket", CREATE, new Object[]{"Printer offline"},
                new TicketPayload(TICKET, true)))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void evaluate_valueIsABlankText_returnsNull() {
        assertThat(expressions.evaluate("#tagId", ADD_TAG, new Object[]{"ticket-1", " "}, null)).isNull();
    }

    @Test
    void evaluate_rawIdOfGlobalId_returnsTheRawId() {
        assertThat(expressions.evaluate("rawId(#id)", ARCHIVE, new Object[]{"VGlja2V0OnJhdy03"}, null))
                .isEqualTo("raw-7");
    }

    @Test
    void evaluate_rawIdOfPlainId_returnsTheIdUnchanged() {
        assertThat(expressions.evaluate("rawId(#id)", ARCHIVE, new Object[]{"671a9e03c2f4"}, null))
                .isEqualTo("671a9e03c2f4");
    }

    @Test
    void isConditionMet_conditionTrue_returnsTrue() {
        assertThat(expressions.isConditionMet("#result.changed", ADD_TAG, TAG_ARGUMENTS, new TicketPayload(TICKET, true)))
                .isTrue();
    }

    @Test
    void isConditionMet_conditionFalse_returnsFalse() {
        assertThat(expressions.isConditionMet("#result.changed", ADD_TAG, TAG_ARGUMENTS, new TicketPayload(TICKET, false)))
                .isFalse();
    }

    @Test
    void evaluate_noResultAndTheExpressionFallsBackToAnArgument_returnsTheArgument() {
        assertThat(expressions.evaluate("#result?.ticket?.id ?: #ticketId", ADD_TAG, TAG_ARGUMENTS, null))
                .isEqualTo("ticket-1");
    }

    @Test
    void isConditionMet_conditionNull_returnsFalse() {
        assertThat(expressions.isConditionMet("#result.changed", ADD_TAG, TAG_ARGUMENTS, new TicketPayload(TICKET, null)))
                .isFalse();
    }

    @Test
    void details_entriesOverArgumentsAndResult_mapsEachKeyToItsValue() {
        assertThat(expressions.details(TAG_DETAILS, ADD_TAG, TAG_ARGUMENTS, new TicketPayload(TICKET, true)))
                .containsExactly(entry("tagId", "tag-9"), entry("ticketTitle", "Printer offline"));
    }

    @Test
    void details_noResult_skipsEntriesReadingResult() {
        assertThat(expressions.details(TAG_DETAILS, ADD_TAG, TAG_ARGUMENTS, null))
                .containsOnly(entry("tagId", "tag-9"));
    }

    @Test
    void details_noResultAndAnEntryFallsBackToAnArgument_keepsIt() {
        String[] fallingBack = {"ticketId = #result?.ticket?.id ?: #ticketId"};

        assertThat(expressions.details(fallingBack, ADD_TAG, TAG_ARGUMENTS, null))
                .containsOnly(entry("ticketId", "ticket-1"));
    }

    @Test
    void details_rawIdOfAListOfIds_mapsEachId() {
        String[] rawIds = {"ticketIds = rawId(#ids)", "projected = #ids.![#root.rawId(#this)]"};
        Object[] ids = {List.of("VGlja2V0OnJhdy03", "671a9e03c2f4")};

        assertThat(expressions.details(rawIds, ARCHIVE_ALL, ids, null)).containsExactly(
                entry("ticketIds", List.of("raw-7", "671a9e03c2f4")),
                entry("projected", List.of("raw-7", "671a9e03c2f4")));
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

        void archiveAll(List<String> ids) {
        }
    }
}
