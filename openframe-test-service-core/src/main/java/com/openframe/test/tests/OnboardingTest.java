package com.openframe.test.tests;

import com.openframe.test.api.OnboardingApi;
import com.openframe.test.data.dto.onboarding.UserOnboardingProgress;
import com.openframe.test.data.dto.shared.GraphqlError;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

// Personal Get Started onboarding (CP-31): the signed-in admin's own progress is reset, walked through every step, finished, skipped and reset again, then put back the way it was found.
@Tag("saas")
@Tag("onboarding")
@DisplayName("User onboarding")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class OnboardingTest extends BaseTest {

    private static final List<String> USER_STEPS =
            List.of("MEET_MINGO", "TICKETS", "SCRIPTING", "MONITORING", "LOGGING", "KNOWLEDGE_MANAGEMENT");
    // A value of the tenant Initial Setup enum, which is not a UserOnboardingStep.
    private static final String TENANT_ONLY_STEP = "MSP_SETUP";
    // Local and server clocks may drift; a stamp counts as "set now" within this window of the call.
    private static final Duration CLOCK_SKEW = Duration.ofMinutes(2);

    private enum Stage { CLEAN, ALL_STEPS, FINISHED, SKIPPED }

    private static UserOnboardingProgress original;
    private static Stage stage;
    private static boolean progressChanged;
    private static boolean originalRestored;

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("Read the signed-in user's Get Started progress")
    @Order(1)
    public void testReadProgress() {
        UserOnboardingProgress progress = OnboardingApi.getUserOnboardingProgress();

        assertThat(progress.getCompletedSteps()).as("completedSteps is a list of UserOnboardingStep values")
                .isNotNull().doesNotHaveDuplicates().isSubsetOf(USER_STEPS);
        assertThat(progress.getCompleted()).as("completed is never null").isNotNull();
        assertThat(progress.getSkipped()).as("skipped is never null").isNotNull();
        assertThat(progress.getCompletedAt() != null).as("completedAt is set exactly when completed is true (a member's stored record, not the super-user stub)")
                .isEqualTo(progress.getCompleted());
        assertThat(progress.getSkippedAt() != null).as("skippedAt is set exactly when skipped is true")
                .isEqualTo(progress.getSkipped());
        original = progress;
    }

    @Tag("feature")
    @Test
    @DisplayName("Reset clears the progress to no steps, not skipped, not completed, and no step completes itself")
    @Order(2)
    public void testResetToCleanState() {
        requireOriginal();
        progressChanged = true;

        UserOnboardingProgress reset = OnboardingApi.resetUserOnboarding();

        assertClean(reset, "The reset answer");
        UserOnboardingProgress read = OnboardingApi.getUserOnboardingProgress();
        assertClean(read, "A read after reset (nothing is derived from customers or devices)");
        stage = Stage.CLEAN;
    }

    @Tag("feature")
    @Test
    @DisplayName("Complete each Get Started step one at a time")
    @Order(3)
    public void testCompleteEachStep() {
        requireStage(Stage.CLEAN, "Reset clears the progress to no steps, not skipped, not completed, and no step completes itself");

        List<String> done = new ArrayList<>();
        for (String step : USER_STEPS) {
            UserOnboardingProgress progress = OnboardingApi.completeUserOnboardingStep(step);
            done.add(step);
            assertThat(progress.getCompletedSteps()).as("After %s the completed steps are exactly %s", step, done)
                    .containsExactlyInAnyOrderElementsOf(done);
            assertThat(progress.getCompleted()).as("Completing %s does not finish the flow", step).isFalse();
            assertThat(progress.getCompletedAt()).as("completedAt stays null after %s", step).isNull();
            assertThat(progress.getSkipped()).as("Completing %s does not skip the flow", step).isFalse();
        }
        UserOnboardingProgress read = OnboardingApi.getUserOnboardingProgress();
        assertThat(read.getCompletedSteps()).as("A read shows all six steps completed")
                .containsExactlyInAnyOrderElementsOf(USER_STEPS);
        assertThat(read.getCompleted()).as("All six steps done is still not finished; only Finish sets completed").isFalse();
        stage = Stage.ALL_STEPS;
    }

    @Tag("feature")
    @Test
    @DisplayName("Completing an already-completed step is idempotent")
    @Order(4)
    public void testCompleteStepIsIdempotent() {
        requireStage(Stage.ALL_STEPS, "Complete each Get Started step one at a time");

        UserOnboardingProgress again = OnboardingApi.completeUserOnboardingStep("MEET_MINGO");

        assertThat(again.getCompletedSteps()).as("A repeated step is not added twice")
                .doesNotHaveDuplicates().containsExactlyInAnyOrderElementsOf(USER_STEPS);
        assertThat(OnboardingApi.getUserOnboardingProgress().getCompletedSteps())
                .as("A read after the repeat holds each step once").containsExactlyInAnyOrderElementsOf(USER_STEPS);
    }

    @Tag("feature")
    @Tag("negative")
    @Test
    @DisplayName("A tenant Initial Setup step is refused as a Get Started step")
    @Order(5)
    public void testTenantStepIsRefused() {
        requireStage(Stage.ALL_STEPS, "Complete each Get Started step one at a time");

        List<GraphqlError> errors = OnboardingApi.attemptCompleteUserOnboardingStepErrors(TENANT_ONLY_STEP);

        assertThat(errors).as("%s is not a UserOnboardingStep, so the refusal is a top-level GraphQL error", TENANT_ONLY_STEP)
                .isNotEmpty();
        assertThat(OnboardingApi.getUserOnboardingProgress().getCompletedSteps())
                .as("The refused call leaves the completed steps untouched").containsExactlyInAnyOrderElementsOf(USER_STEPS);
    }

    @Tag("feature")
    @Test
    @DisplayName("Finish sets completed and completedAt, keeps the steps, and a second Finish keeps the first stamp")
    @Order(6)
    public void testFinishOnboarding() {
        requireStage(Stage.ALL_STEPS, "Complete each Get Started step one at a time");
        Instant calledAt = Instant.now();

        UserOnboardingProgress finished = OnboardingApi.completeUserOnboarding();

        assertThat(finished.getCompleted()).as("Finish sets completed").isTrue();
        assertStampedNow(finished.getCompletedAt(), calledAt, "completedAt");
        assertThat(finished.getCompletedSteps()).as("Finish keeps the completed steps")
                .containsExactlyInAnyOrderElementsOf(USER_STEPS);
        assertThat(finished.getSkipped()).as("Finish does not skip").isFalse();
        assertSameAsRead(finished, "The Finish answer");
        stage = Stage.FINISHED;

        UserOnboardingProgress again = OnboardingApi.completeUserOnboarding();
        assertThat(again.getCompleted()).as("A second Finish leaves the flow finished").isTrue();
        assertThat(millis(again.getCompletedAt())).as("A second Finish keeps the first completedAt")
                .isEqualTo(millis(finished.getCompletedAt()));
    }

    @Tag("feature")
    @Test
    @DisplayName("Reset clears a finished progress")
    @Order(7)
    public void testResetClearsFinished() {
        requireStage(Stage.FINISHED, "Finish sets completed and completedAt, keeps the steps, and a second Finish keeps the first stamp");

        UserOnboardingProgress reset = OnboardingApi.resetUserOnboarding();

        assertClean(reset, "The reset answer after Finish");
        assertClean(OnboardingApi.getUserOnboardingProgress(), "A read after resetting a finished progress");
        stage = Stage.CLEAN;
    }

    @Tag("feature")
    @Test
    @DisplayName("Skip midway sets skipped and skippedAt and keeps the steps done so far")
    @Order(8)
    public void testSkipOnboarding() {
        requireStage(Stage.CLEAN, "Reset clears a finished progress");
        OnboardingApi.completeUserOnboardingStep("TICKETS");
        Instant calledAt = Instant.now();

        UserOnboardingProgress skipped = OnboardingApi.skipUserOnboarding();

        assertThat(skipped.getSkipped()).as("Skip sets skipped").isTrue();
        assertStampedNow(skipped.getSkippedAt(), calledAt, "skippedAt");
        assertThat(skipped.getCompletedSteps()).as("Skip keeps the step completed before it").containsExactly("TICKETS");
        assertThat(skipped.getCompleted()).as("Skip does not finish").isFalse();
        assertThat(skipped.getCompletedAt()).as("Skip sets no completedAt").isNull();
        assertSameAsRead(skipped, "The Skip answer");
        stage = Stage.SKIPPED;

        UserOnboardingProgress again = OnboardingApi.skipUserOnboarding();
        assertThat(millis(again.getSkippedAt())).as("A second Skip keeps the first skippedAt")
                .isEqualTo(millis(skipped.getSkippedAt()));
    }

    @Tag("feature")
    @Test
    @DisplayName("Reset clears a skipped progress")
    @Order(9)
    public void testResetClearsSkip() {
        requireStage(Stage.SKIPPED, "Skip midway sets skipped and skippedAt and keeps the steps done so far");

        UserOnboardingProgress reset = OnboardingApi.resetUserOnboarding();

        assertClean(reset, "The reset answer after Skip");
        assertClean(OnboardingApi.getUserOnboardingProgress(), "A read after resetting a skipped progress");
        stage = Stage.CLEAN;
    }

    @Tag("feature")
    @Test
    @DisplayName("Restore the progress the user had before the run")
    @Order(10)
    public void testRestoreOriginalProgress() {
        requireOriginal();
        assumeTrue(progressChanged, "No case changed the progress, so there is nothing to restore");

        OnboardingApi.resetUserOnboarding();
        for (String step : original.getCompletedSteps()) {
            OnboardingApi.completeUserOnboardingStep(step);
        }
        if (original.getCompleted()) {
            OnboardingApi.completeUserOnboarding();
        }
        if (original.getSkipped()) {
            OnboardingApi.skipUserOnboarding();
        }
        originalRestored = true;

        UserOnboardingProgress restored = OnboardingApi.getUserOnboardingProgress();
        assertThat(restored.getCompletedSteps()).as("The original completed steps are back")
                .containsExactlyInAnyOrderElementsOf(original.getCompletedSteps());
        assertThat(restored.getCompleted()).as("The original completed flag is back").isEqualTo(original.getCompleted());
        assertThat(restored.getSkipped()).as("The original skipped flag is back").isEqualTo(original.getSkipped());
        assertThat(restored.getCompletedAt() != null).as("completedAt is set exactly when it was").isEqualTo(original.getCompletedAt() != null);
        assertThat(restored.getSkippedAt() != null).as("skippedAt is set exactly when it was").isEqualTo(original.getSkippedAt() != null);
    }

    // Puts the original progress back when the run stopped before the restore case did; the raw calls never throw.
    @AfterAll
    public static void restoreOriginal() {
        if (original == null || !progressChanged || originalRestored) {
            return;
        }
        OnboardingApi.attemptResetUserOnboarding();
        for (String step : original.getCompletedSteps()) {
            OnboardingApi.attemptCompleteUserOnboardingStep(step);
        }
        if (original.getCompleted()) {
            OnboardingApi.attemptCompleteUserOnboarding();
        }
        if (original.getSkipped()) {
            OnboardingApi.attemptSkipUserOnboarding();
        }
    }

    private static void requireOriginal() {
        assumeTrue(original != null,
                "The original progress was not read in \"Read the signed-in user's Get Started progress\"; nothing is changed without it");
    }

    private static void requireStage(Stage expected, String producedBy) {
        requireOriginal();
        assumeTrue(stage == expected, "The progress is not " + expected + "; see \"" + producedBy + "\"");
    }

    private static void assertClean(UserOnboardingProgress progress, String what) {
        assertThat(progress.getCompletedSteps()).as("%s has no completed steps", what).isEmpty();
        assertThat(progress.getCompleted()).as("%s is not completed", what).isFalse();
        assertThat(progress.getCompletedAt()).as("%s has no completedAt", what).isNull();
        assertThat(progress.getSkipped()).as("%s is not skipped", what).isFalse();
        assertThat(progress.getSkippedAt()).as("%s has no skippedAt", what).isNull();
    }

    // A mutation answers with the full progress object, so it must equal a fresh read (stamps compared at the stored millisecond precision).
    private static void assertSameAsRead(UserOnboardingProgress answer, String what) {
        UserOnboardingProgress read = OnboardingApi.getUserOnboardingProgress();
        assertThat(read.getCompletedSteps()).as("%s and a read agree on the steps", what)
                .containsExactlyInAnyOrderElementsOf(answer.getCompletedSteps());
        assertThat(read.getCompleted()).as("%s and a read agree on completed", what).isEqualTo(answer.getCompleted());
        assertThat(millis(read.getCompletedAt())).as("%s and a read agree on completedAt", what).isEqualTo(millis(answer.getCompletedAt()));
        assertThat(read.getSkipped()).as("%s and a read agree on skipped", what).isEqualTo(answer.getSkipped());
        assertThat(millis(read.getSkippedAt())).as("%s and a read agree on skippedAt", what).isEqualTo(millis(answer.getSkippedAt()));
    }

    private static void assertStampedNow(Instant stamp, Instant calledAt, String field) {
        assertThat(stamp).as("%s is set", field).isNotNull();
        assertThat(stamp).as("%s is the time of the call", field)
                .isBetween(calledAt.minus(CLOCK_SKEW), Instant.now().plus(CLOCK_SKEW));
    }

    private static Instant millis(Instant instant) {
        return instant == null ? null : instant.truncatedTo(ChronoUnit.MILLIS);
    }
}
