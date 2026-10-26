package com.openframe.test.tests.ai;

import com.openframe.test.api.DialogApi;
import com.openframe.test.api.MessageApi;
import com.openframe.test.data.dto.ai.ChatType;
import com.openframe.test.data.dto.ai.MessageResponse;
import com.openframe.test.data.dto.ai.SendMessageRequest;
import com.openframe.test.helpers.ai.ApprovalPolicy;
import com.openframe.test.helpers.ai.AssistantRunner;
import com.openframe.test.helpers.ai.CompactionWaiter;
import com.openframe.test.helpers.ai.DialogFixture;
import com.openframe.test.helpers.ai.RunId;
import com.openframe.test.helpers.ai.RunResult;
import com.openframe.test.helpers.ai.RunWaiter;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Manual context compaction ("Compact Chat Memory") in a Mingo chat: {@code POST /dialogs/{id}/compact}
 * summarises the history, and the model then continues from that summary alone. Each case asserts what a
 * technician relies on afterwards, not merely that the endpoint answered.
 *
 * <p>Threshold-triggered compaction is deliberately not covered: reaching Mingo's threshold takes a
 * conversation of about 120k tokens.
 */
@Slf4j
@Tag("ai")
@Tag("mingo")
@Tag("compaction")
@DisplayName("Mingo — context compaction")
public class MingoCompactionTest extends MingoBaseTest {

    /** How far the time Mingo states may be from the runner's clock. */
    private static final Duration TIME_TOLERANCE = Duration.ofMinutes(10);
    private static final Pattern TIMESTAMP = Pattern.compile("(\\d{4}-\\d{2}-\\d{2})[T ](\\d{2}:\\d{2})(:\\d{2})?");

    @Test
    @DisplayName("Mingo remembers what it was told after its chat is compacted")
    public void testKeepsContextAcrossCompaction() {
        String code = plantCodeAndCompact();

        assertThat(DialogApi.compact(dialog.getDialogId()))
                .as("A second compaction with nothing new since the summary must be refused")
                .isEqualTo(422);

        RunResult after = followUp("What reference code did I ask you to remember? Reply with just the code.");
        assertThat(after.finalText())
                .as("After compaction Mingo must still know the code %s.\n%s", code, after)
                .contains(code);
    }

    @Test
    @DisplayName("Mingo tells the current time after its chat is compacted")
    public void testCurrentTimeAfterCompaction() {
        plantCodeAndCompact();

        RunResult after = followUp("What is the current date and time in UTC? Reply with only the timestamp "
                + "in ISO-8601, for example 2026-01-31T13:45Z.");
        Instant now = Instant.now();
        Instant stated = statedTime(after.finalText());
        assertThat(stated)
                .as("Mingo must state a UTC timestamp after compaction.\n%s", after)
                .isNotNull();
        assertThat(Duration.between(stated, now).abs())
                .as("Mingo stated %s after compaction; the time is %s.\n%s", stated, now, after)
                .isLessThanOrEqualTo(TIME_TOLERANCE);
    }

    @Test
    @DisplayName("Compacting an empty Mingo chat is refused")
    public void testCompactEmptyChat() {
        dialog = DialogFixture.open();

        assertThat(DialogApi.compact(dialog.getDialogId()))
                .as("A chat with no messages has nothing to compact")
                .isEqualTo(422);
    }

    @Test
    @DisplayName("Compacting a Mingo chat while it is replying is refused")
    public void testCompactWhileReplying() {
        dialog = DialogFixture.open();
        String dialogId = dialog.getDialogId();
        // Sent directly rather than through prompt(): the run must still hold the dialog when compact arrives.
        MessageResponse sent = MessageApi.sendMessage(SendMessageRequest.builder()
                .dialogId(dialogId)
                .content("In three sentences, explain what an MDM policy is.")
                .chatType(ChatType.ADMIN_AI_CHAT)
                .build());

        int status = DialogApi.compact(dialogId);
        // Let the reply finish before asserting, so teardown archives an idle dialog either way.
        new RunWaiter().awaitCompletion(dialogId, ChatType.ADMIN_AI_CHAT, Instant.parse(sent.getCreatedAt()),
                ApprovalPolicy.AUTO_REJECT);

        assertThat(status).as("Compaction requested while Mingo is replying must be refused").isEqualTo(409);
    }

    /** Opens a chat, gives Mingo a code to remember, compacts, and checks the summary kept it. */
    private String plantCodeAndCompact() {
        String code = "E2E-" + RunId.next();
        prompt("Please remember this reference code for later: " + code + ". Reply with just OK.",
                ApprovalPolicy.AUTO_REJECT);
        String dialogId = dialog.getDialogId();

        assertThat(CompactionWaiter.requestWhenIdle(dialogId))
                .as("Compaction of a chat with history must be accepted")
                .isEqualTo(202);
        String summary = CompactionWaiter.awaitSummary(dialogId, ChatType.ADMIN_AI_CHAT);
        assertThat(summary).as("The compaction summary must keep the code %s", code).contains(code);
        return code;
    }

    private RunResult followUp(String text) {
        return new AssistantRunner(dialog.getDialogId()).ask(text, ApprovalPolicy.AUTO_REJECT);
    }

    /** The first "yyyy-MM-dd[T ]HH:mm[:ss]" in the text, read as UTC, or null when there is none. */
    private static Instant statedTime(String text) {
        if (text == null) {
            return null;
        }
        Matcher m = TIMESTAMP.matcher(text);
        if (!m.find()) {
            return null;
        }
        String seconds = m.group(3) == null ? ":00" : m.group(3);
        return LocalDateTime.parse(m.group(1) + "T" + m.group(2) + seconds).toInstant(ZoneOffset.UTC);
    }
}
